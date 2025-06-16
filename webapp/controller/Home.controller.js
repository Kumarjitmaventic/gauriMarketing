sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "marketingcampaign/zcrmktmarketingcampaign/utils/formatter",
        "sap/ui/layout/HorizontalLayout",
        "sap/ui/layout/VerticalLayout",
        "sap/m/Dialog",
        "sap/m/Button",
        "sap/m/Label",
        "sap/m/library",
        "sap/m/Text",
        "sap/m/TextArea",
    ],
    function (
        Controller,
        MessageToast,
        MessageBox,
        formatter,
        HorizontalLayout,
        VerticalLayout,
        Dialog,
        Button,
        Label,
        mobileLibrary,
        Text,
        TextArea
    ) {
        "use strict";
        // shortcut for sap.m.ButtonType
        const ButtonType = mobileLibrary.ButtonType;

        // shortcut for sap.m.DialogType
        const DialogType = mobileLibrary.DialogType;
        return Controller.extend(
            "marketingcampaign.zcrmktmarketingcampaign.controller.Home",
            {
                formatter: formatter,
                onInit: async function () {
                    var oView = this.getView();
                    oView.setBusy(true);

                    const oOwnComp = this.getOwnerComponent();
                    const oDocModel = oOwnComp.getModel("docModel");
                    const requestModel = oOwnComp.getModel("requestModel");
                    const oModel = oOwnComp.getModel();
                    const uiModel = oOwnComp.getModel("uiModel");

                    this._setDefaultValue();

                    /**
                        all modes are
                        new : fore new request, 
                        draft : draft created request, 
                        edit : while editing draft request,
                        read / viewer : to view the request details, 
                        approver : to approve the request,
                    */
                    // setting default mode
                    // getting loggedin user info
                    uiModel.setProperty("/ui", {
                        mode: "new", // based on mode button will be shown
                        preMode: null, // store the previous mode
                        role: "Requester", // based on role action will be taken
                        loginUserInfo: null, // current login user info
                        requestId: "", // unique id of request
                        requestStatus: "NEW", // request status
                    });
                    uiModel.setProperty("/backup", null); // to keep backup for canel operation

                    try {
                        let oDataResponse = await this._OdataSynceRead(
                            "/UserSet('')",
                            oModel
                        );

                        // updaing loggedin user info
                        uiModel.setProperty(
                            "/ui/loginUserInfo",
                            oDataResponse || nul
                        );
                        uiModel.setProperty(
                            "/ui/role",
                            oDataResponse?.Role || "default user"
                        );

                        uiModel.refresh();

                        // otptional need to change later
                        // if (oDataResponse?.Role == "Requester") {
                        if (uiModel.getProperty("/ui/mode") == "new") {
                            requestModel.setProperty(
                                "/empDetail",
                                oDataResponse
                            );
                            requestModel.refresh();
                        }
                    } catch (error) {
                        MessageBox.error("Faild to load user information.");
                    }

                    let requestId = this._getRequestIdFromURL();

                    await this.fetchRequestDetailsAndUpdateModel(requestId);
                    oView.setBusy(false);
                },

                fetchRequestDetailsAndUpdateModel: async function (requestId) {
                    const oOwnComp = this.getOwnerComponent() || this.getView();
                    const oDocModel = oOwnComp.getModel("docModel");
                    const requestModel = oOwnComp.getModel("requestModel");
                    const oModel = oOwnComp.getModel();
                    const uiModel = oOwnComp.getModel("uiModel");

                    if (requestId) {
                        uiModel.setProperty("/ui/requestId", requestId);

                        let requestDetails;
                        try {
                            requestDetails = await this._OdataSynceRead(
                                "/RequestSet('" + requestId + "')",
                                oModel,
                                {
                                    $expand: "Document,Approval",
                                }
                            );
                        } catch (error) {
                            let message = "";
                            switch (error?.statusCode) {
                                case "404":
                                    message = "The request not found.";
                                    break;
                                case "403":
                                    message =
                                        "You are not authorize to view this Request.";
                                    break;
                                default:
                                    message =
                                        "Something wrong with this request ID.";
                                    break;
                            }
                            message += "Going back to Request List Page";

                            MessageBox.error(message, {
                                title: "Error",
                                onClose: function () {
                                    this._crossApplicationNavigation(
                                        "ZMKTCAMP",
                                        "displaylist"
                                    );
                                }.bind(this),
                            });
                        }

                        if (requestDetails) {
                            // keeping backup
                            uiModel.setProperty("/backup", JSON.parse(JSON.stringify(requestDetails)) );
                            uiModel.setProperty(
                                "/ui/requestStatus",
                                requestDetails.Status
                            );
                            let uiModelPropertices = uiModel.getProperty("/ui");

                            // for draft mode
                            if (requestDetails.Status == "DRF")
                                this._switchMode("draft"); // changing mode
                            // for approver mode
                            else if (
                                requestDetails.Status === "PGS" &&
                                uiModelPropertices.role === "Approver"
                            ) {
                                this._switchMode("approver");
                            } else this._switchMode("view");

                            // updating current steps
                            requestModel.setProperty(
                                "/keyPermitType",
                                requestDetails?.PermitType
                            );
                            requestModel.setProperty(
                                "/remarks",
                                requestDetails?.Remarks
                            );

                            oDocModel.setProperty(
                                "/Document",
                                requestDetails?.Document?.results || []
                            );

                            // fetch data for requester
                            let employeDetails = await this._OdataSynceRead(
                                `/UserSet('${requestDetails?.RequesterId}')`,
                                oModel
                            );
                            if (employeDetails) {
                                requestModel.setProperty(
                                    "/empDetail",
                                    employeDetails
                                );
                                requestModel.refresh();
                            }
                        }
                    }
                },

                onDownloadFiles(oEvent) {
                    //Fetching selected Items from table
                    let aSelectedItems =
                        this.byId("idProductsTable").getSelectedItems();

                    let oModel = this.getView().getModel("docModel");

                    aSelectedItems.forEach((element) => {
                        var sPath = element.getBindingContextPath();
                        var docItem = oModel.getProperty(sPath);

                        if (docItem.FileContent) {
                            this.downloadDOc(
                                docItem.FileContent,
                                docItem.FileName,
                                docItem.MimeType
                            );
                        } else {
                            $.ajax({
                                url: `/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV/DocumentSet('${docItem.DocId}')/$value`,
                                type: "GET",
                                xhrFields: {
                                    responseType: "blob",
                                },
                                success: function (blob) {
                                    var url = URL.createObjectURL(blob);
                                    window.open(url);
                                },
                                error: function (xhr, status, error) {
                                    console.error(
                                        "Error fetching stream:",
                                        error
                                    );
                                },
                            });
                        }
                    });
                    console.log(oEvent);
                },

                onPressGenPdf: function () {
                    let reqId = this.getView()
                        .getModel("uiModel")
                        .getProperty("/ui/requestId");
                    if (reqId)
                        $.ajax({
                            url: `/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV/RequestPdfSet('${reqId}')/$value`,
                            type: "GET",
                            xhrFields: {
                                responseType: "blob",
                            },
                            success: function (blob) {
                                var url = URL.createObjectURL(blob);
                                window.open(url);
                            },
                            error: function (xhr, status, error) {
                                console.error("Error fetching stream:", error);
                            },
                        });
                    else
                        MessageToast.show(
                            "Somthing went wrong!! Please refresh the page"
                        );
                },
                onRequestSubmit() {
                    var oDialog = new sap.m.Dialog({
                        title: "Confirmation",
                        type: "Message",
                        content: new sap.m.Text({
                            text: "Do you want to submit the request",
                        }),
                        beginButton: new sap.m.Button({
                            text: "OK",
                            press: function () {
                                this.onSubmit();
                                oDialog.close();
                            }.bind(this),
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function () {
                                oDialog.close();
                            },
                        }),
                        afterClose: function () {
                            oDialog.destroy();
                        },
                    });

                    oDialog.open();
                },

                onSubmit: async function () {
                    const uiModel = this.getView().getModel("uiModel");
                    const oModel = this.getView().getModel();
                    let requestId = uiModel.getProperty("/ui/requestId");
                    if (!requestId)
                        MessageToast.show(
                            "Somthing wrong please referesh the page"
                        );
                    try {
                        let response = await this._OdataSyncUpdateReqSave(
                            `/RequestSet('${requestId}')`,
                            oModel,
                            { Status: "INI" }
                        );
                        if (response) {
                            MessageBox.success(
                                `Request ${requestId} Submitted Sucessfully`
                            );
                            uiModel.setProperty("/ui/mode", "view");
                            uiModel.refresh(true);
                            this.fetchRequestDetailsAndUpdateModel(requestId);
                        } else
                            throw new Error(
                                `Faild to submit request ${requestId}`
                            );
                    } catch (error) {
                        MessageBox.error(error.message);
                    }
                },
                onPressDelete: function (oEvent) {
                    let oView = this.getView();
                    let uiModel = oView.getModel("uiModel");
                    let oModel = oView.getModel();
                    let requestId = uiModel.getProperty("/ui/requestId");
                    let that = this;

                    this.openConfirmationDialog(
                        "Delete Request",
                        `Are you sure you want to delete Request ID: ${requestId}?`,
                        async function () {
                            // onConfirm
                            try {
                                let response = await that._OdataSyncDelete(
                                    `/RequestSet('${requestId}')`,
                                    oModel
                                );
                                let routHistory = that._getRequestIdFromURL();
                                if (response) {
                                    that._crossApplicationNavigation(
                                        "ZMKTCAMP",
                                        routHistory ? "displaylist" : "Display"
                                    );
                                }
                            } catch (error) {
                                MessageBox.error(error.message);
                            }
                        },
                        function () {
                            //skip
                        }
                    );
                },
                onUploadFiles() {
                    if (!this._oDialog) {
                        this._oDialog = sap.ui.xmlfragment(
                            this.getView().getId(),
                            "marketingcampaign.zcrmktmarketingcampaign.fragments.uploadFile",
                            this
                        );
                        this.getView().addDependent(this._oDialog);
                    }
                    this._oDialog.open();
                },
                onEditPress(oEvent) {
                    this._switchMode("edit");
                },
                onPressClear: function (oEvent) {
                    this._setDefaultValue();
                },

                onApproverAction: async function (
                    oEvent,
                    actionText,
                    decisionNote
                ) {
                    const oView = this.getView();

                    const oModel = oView.getModel();
                    const oUiModel = oView.getModel("uiModel");
                    const oRequestModel = oView.getModel("requestModel");

                    let requestId = oUiModel.getProperty("/ui/requestId");

                    try {
                        // uploading doc
                        let updateDocRes = await this.uploadDocuments(
                            requestId
                        );

                        if (updateDocRes) {
                            let payload = {
                                RequestId: requestId,
                                Action: actionText,
                                DecisionNote: decisionNote || "",
                            };
                            let actionResponse =
                                await this._OdataSyncPostReqSave(
                                    `/ApproveSet`,
                                    oModel,
                                    payload
                                );

                            if (actionResponse) {
                                MessageToast.show("Request Approved! ");
                                oUiModel.setProperty(
                                    "/ui/requestStatus",
                                    "APR"
                                );

                                this._switchMode("view");
                                this.fetchRequestDetailsAndUpdateModel(
                                    requestId
                                );
                            }
                        }
                    } catch (error) {
                        MessageBox.error(error.message);
                    }

                    oUiModel.refresh();
                    oRequestModel.refresh();
                },

                onPressActions: async function (oEvent) {
                    let actionText =
                        oEvent.getSource().getText() == "Approve"
                            ? "Approve"
                            : "Reject";

                    this.onActionConfirmDialogBox(actionText);
                },

                onActionConfirmDialogBox: function (actionType) {
                    let oUiModel = this.getView().getModel("uiModel");
                    oUiModel.setProperty("/actionText", actionType);

                    // if (!this.onApproverActionConfirmDialog) {
                    let onApproverActionConfirmDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        title: actionType,
                        contentWidth: "500px",
                        contentHeight: "200px",
                        content: [
                            new VerticalLayout({
                                content: [
                                    new HorizontalLayout({
                                        width: "100%",
                                        content: [
                                            new Text({
                                                text: "Note : ",
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new TextArea("confirmationNote", {
                                width: "100%",
                                height: "120px",
                                maxLength: 255,
                                placeholder: "Decision note (Optional)",
                            }),
                        ],
                        beginButton: new Button({
                            type:
                                actionType == "Approve"
                                    ? ButtonType.Accept
                                    : ButtonType.Reject,
                            text: actionType,
                            press: function (oEvent) {
                                let decisionNote = sap.ui
                                    .getCore()
                                    .byId("confirmationNote")
                                    .getValue(); // getting message
                                this.onApproverAction(
                                    oEvent,
                                    actionType,
                                    decisionNote
                                );
                                onApproverActionConfirmDialog.close();
                            }.bind(this),
                        }),
                        endButton: new Button({
                            text: "Cancel",
                            press: function () {
                                onApproverActionConfirmDialog.close();
                                sap.ui
                                    .getCore()
                                    .byId("confirmationNote")
                                    .setValue(""); // clear message
                            }.bind(this),
                        }),
                        afterClose: function () {
                            onApproverActionConfirmDialog.destroy();
                        },
                    });

                    // Set model on dialog directly
                    onApproverActionConfirmDialog.setModel(oUiModel, "uiModel");

                    // add dialog as dependent (inherits models automatically)
                    this.getView().addDependent(onApproverActionConfirmDialog);
                    // }

                    onApproverActionConfirmDialog.open();
                },

                onPressCancel(oEvent) {
                    const oView = this.getView();
                    const oDocModel = oView.getModel("docModel");
                    const requestModel = oView.getModel("requestModel");
                    const uiModel = oView.getModel("uiModel");
                    const backup = JSON.parse(
                        JSON.stringify(uiModel.getProperty("/backup"))
                    ); // deep copy

                    if (!backup?.Document?.results || !backup?.PermitType) {
                        MessageBox.error(
                            "Somthing wrong! Faild to rollback please refresh the page."
                        );
                        return;
                    }

                    oDocModel.setProperty("/Document", backup.Document.results); // restore doc
                    requestModel.setProperty("/remarks", backup.Remarks); // restore remarks
                    requestModel.setProperty(
                        "/keyPermitType",
                        backup.PermitType
                    ); // restore permittype

                    oDocModel.refresh(true);
                    requestModel.refresh(true);

                    this._switchMode("draft", null);
                },

                onClose() {
                    if (this._oDialog) {
                        this._oDialog.close();
                    }
                    this.byId("documentTypeCombobox").setSelectedKey("");
                    this.byId("fileUploader").setValue("");
                },

                onFileSelectionChange(oEvent) {
                    let oDocModel = this.getView().getModel("docModel");
                    if (oEvent.getParameters().newValue) {
                        oDocModel.setProperty("/valueState/file", "None");
                        oDocModel.setProperty(
                            "/Doc/file",
                            oEvent.getSource().oFileUpload.files[0]
                        );
                    } else {
                        oDocModel.setProperty("/valueState/file", "Error");
                        oDocModel.setProperty("/Doc/file", null);
                    }
                },

                onDeleteFile() {
                    //Fetching selected Items from table
                    const oTable = this.byId("idProductsTable");
                    const aSelectedItems = oTable.getSelectedItems();
                    oTable.removeSelections();
                    this.onDeleteFiles(aSelectedItems);
                },
                onDeleteFiles(aSelectedItems) {
                    if (aSelectedItems.length === 0) {
                        MessageToast.show(
                            "Please select at least one row to delete."
                        );
                        return;
                    }
                    const oModel = this.getView().getModel("docModel");
                    let aDocuments = oModel.getProperty("/Document");
                    const indicesToRemove = aSelectedItems.map((item) =>
                        parseInt(
                            item.getBindingContextPath().split("/").pop(),
                            10
                        )
                    );
                    aDocuments = aDocuments.filter(
                        (_, idx) => !indicesToRemove.includes(idx)
                    );
                    oModel.setProperty("/Document", aDocuments);
                    oModel.refresh(true);
                },

                onAddFile(oEvent) {
                    const oDocModel = this.getView().getModel("docModel");
                    const oFile = oDocModel.getProperty("/Doc/file");
                    const docType = oDocModel.getProperty("/Doc/docType");
                    const aDocuments = oDocModel.getProperty("/Document");

                    if (!docType) {
                        MessageToast.show("Please select document type");
                        oDocModel.setProperty("/valueState/docType", "Error");
                        oDocModel.refresh(true);
                        return;
                    }
                    if (!oFile) {
                        MessageToast.show("Please select a file first.");
                        oDocModel.setProperty("/valueState/file", "Error");
                        oDocModel.refresh(true);
                        return;
                    }

                    var reader = new FileReader();
                    reader.onload = function (e) {
                        // let RequestId = "000000000085"; // that.getView().getModel("uiModel").getProperty("/RequestId");
                        // let sUrl="/RequestSet('"+RequestId+"')/Document"

                        const binaryArray = e.target.result;
                        const blob = new Blob([binaryArray], {
                            type: oFile.type,
                        });
                        const mimeType = oFile.type; // Default to binary if type is not available
                        const oDocModel = this.getView().getModel("docModel");
                        var formData = new FormData();
                        formData.append("file", oFile);
                        let oData = {
                            FileName: oFile.name,
                            FileContent: blob,
                            DocType: docType,
                            Mimetype: mimeType,
                            status: "Draft",
                        };

                        aDocuments.push(oData);
                        oDocModel.refresh(true);
                        if (this._oDialog) {
                            this._oDialog.close();
                        }
                        this.byId("documentTypeCombobox").setSelectedKey("");
                        this.byId("fileUploader").setValue("");
                    }.bind(this);
                    reader.readAsArrayBuffer(oFile);

                    oDocModel.setProperty("/Doc", {
                        docType: "",
                        fileName: "",
                        file: "",
                    });
                    oDocModel.setProperty("/valueState", {
                        docType: "None",
                        file: "None",
                    });
                    oDocModel.refresh();
                },

                onSelectionChange(oEvent) {
                    let oDocModel = this.getView().getModel("docModel");
                    if (oDocModel.getProperty("/Doc/docType") != "")
                        oDocModel.setProperty("/valueState/docType", "None");
                },

                onSelectionPermit(oEvent) {
                    // this._setComboBoxText(oEvent, "empModel");
                    oEvent.oSource.setValueState("None");
                },

                downloadDOc: function (binary, fileName, mimeType) {
                    // Decode Base64
                    const blob = new Blob([binary], { type: mimeType });

                    // Create download link
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = fileName;

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                },

                onPressSave: async function () {
                    const oView = this.getView();
                    oView.setBusy(true);
                    const oModel = oView.getModel();
                    const oRequestModel = oView.getModel("requestModel");
                    const oRequestPropertices = oRequestModel.getProperty("/");
                    const uiModel = oView.getModel("uiModel");
                    const uiModelProperties = uiModel.getProperty("/");

                    let requestId =
                        uiModelProperties?.ui?.requestId ||
                        this._getRequestIdFromURL();

                    // checking for permit type validation
                    if (!oRequestPropertices?.keyPermitType) {
                        MessageToast.show("Please select a Permit Type.");
                        this.byId("idPermitTypeCombobox").setValueState(
                            "Error"
                        );
                        oView.setBusy(false);
                        return;
                    }

                    // preparing payload for permit save
                    const payload = {
                        PermitType: oRequestPropertices?.keyPermitType || "",
                        Remarks: oRequestPropertices?.remarks || "",
                        Status: "DRF",
                    };

                    let flagForCreateStatus = false;

                    // updating create request
                    if (requestId) {
                        // checking is there any changes or not
                        if (this._compareRequestDetailsChanges()) {
                            try {
                                let response =
                                    await this._OdataSyncUpdateReqSave(
                                        `/RequestSet(${requestId})`,
                                        oModel,
                                        payload
                                    );
                                console.log(response);
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    } else {
                        flagForCreateStatus = true;
                        // creating new request
                        try {
                            let response = await this._OdataSyncPostReqSave(
                                "/RequestSet",
                                oModel,
                                payload
                            );
                            requestId = response?.RequestId;

                            if (!requestId)
                                throw new Error("Faild to create request");
                            else {
                                uiModel.setProperty("/ui/requestId", requestId);
                            }
                        } catch (error) {
                            MessageBox.error(error.message);
                            return;
                        }
                    }

                    try {
                        // uploading doc
                        let updateDocRes = await this.uploadDocuments(
                            requestId
                        );

                        // if everything successfully then chnage to draft mode
                        if (updateDocRes) {
                            this._switchMode("draft");
                        }

                        MessageBox.success(
                            flagForCreateStatus
                                ? `Requeset has been created with id ${requestId}.`
                                : `Requeset ${requestId} has been updated.`,
                            {
                                onClose: () => {
                                    this.fetchRequestDetailsAndUpdateModel(
                                        requestId
                                    );
                                },
                            }
                        );

                        oRequestModel.refresh(true);
                        uiModel.refresh(true);
                    } catch (error) {
                        MessageBox.error(error.message);
                    }

                    oView.setBusy(false);
                },

                uploadDocuments: async function (requestId) {
                    const oView = this.getView();
                    const oModel = oView.getModel();
                    const oDocModel = oView.getModel("docModel");
                    const aDocuments = oDocModel.getProperty("/Document");
                    const csrfToken = oModel.getSecurityToken();
                    const uiModel = oView.getModel("uiModel");

                    const backup = uiModel.getProperty("/backup");

                    let currentDocId = {};

                    const uploadDocPayloads = [];
                    aDocuments.forEach((element) => {
                        if (element?.status === "Draft") {
                            let formData = new FormData();
                            formData.append(
                                "file",
                                element.FileContent,
                                element.FileName
                            );
                            const oHeaders = {
                                slug: element.FileName,
                                "Content-Type": element.Mimetype,
                                doctype: element.DocType,
                                "X-CSRF-Token": csrfToken,
                            };
                            const promise = new Promise((resolve, reject) => {
                                $.ajax({
                                    url:
                                        "/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV/RequestSet('" +
                                        requestId +
                                        "')/Document",
                                    type: "POST",
                                    headers: oHeaders,
                                    processData: false,
                                    contentType: false,
                                    data: formData,
                                    success: function (oData, Response) {
                                        resolve(oData);
                                    },
                                    error: function (err) {
                                        reject(err);
                                    },
                                });
                            });
                            uploadDocPayloads.push(promise);
                        } else {
                            // tracking how many doc present in current list
                            currentDocId[element?.DocId] = true;
                        }
                    });

                    let that = this;
                    backup?.Document?.results.forEach((item) => {
                        // if backup doc id not present in current doc id then its deleted
                        if (
                            !currentDocId[item.DocId] &&
                            item.DocId != undefined
                        ) {
                            aDocuments.push(
                                that._OdataSyncDelete(
                                    `/DocumentSet('${item.DocId}')`,
                                    oModel
                                )
                            );
                        }
                    });

                    try {
                        let responses = await Promise.all(uploadDocPayloads);
                        return responses;
                    } catch (error) {
                        throw new Error("Faild to update the documetns");
                    }
                },

                _OdataSynceRead: async function (
                    sPath,
                    oModel,
                    parameter = {}
                ) {
                    return new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            urlParameters: parameter,
                            success: function (oData) {
                                resolve(oData);
                            },
                            error: function (oError) {
                                reject(oError);
                            },
                        });
                    });
                },

                _OdataSyncUpdateReqSave: async function (
                    sPath,
                    oModel,
                    payload
                ) {
                    return new Promise((resolve, reject) => {
                        oModel.update(sPath, payload, {
                            success: function (oData, response) {
                                resolve(oData || response);
                            },
                            error: function (oError) {
                                reject(oError);
                            },
                        });
                    });
                },
                _OdataSyncPostReqSave: async function (sPath, oModel, payload) {
                    return new Promise((resolve, reject) => {
                        oModel.create(sPath, payload, {
                            success: function (oData, response) {
                                resolve(oData);
                            },
                            error: function (oError) {
                                reject(oError);
                            },
                        });
                    });
                },

                _OdataSyncDelete: async function (sPath, oModel) {
                    return new Promise((resolve, reject) => {
                        oModel.remove(sPath, {
                            success: function (oData, response) {
                                resolve(oData || response);
                            },
                            error: function (oError) {
                                reject(oError);
                            },
                        });
                    });
                },

                _getRequestIdFromURL: function () {
                    let oStartupParameters =
                        this.getOwnerComponent().getComponentData()
                            .startupParameters;

                    // let createFlg = false;
                    // let sUrl = "/UserSet('')";

                    // checking for draft or approval
                    if (
                        oStartupParameters &&
                        oStartupParameters?.RequestId?.[0]
                    )
                        return oStartupParameters.RequestId[0];
                    else return null;
                },

                _compareRequestDetailsChanges: function () {
                    const backeup = this.getView()
                        .getModel("uiModel")
                        .getProperty("/backup");
                    const currentData = this.getView()
                        .getModel("requestModel")
                        .getProperty("/");

                    if (backeup && currentData)
                        return !(
                            backeup?.Remarks ==
                                currentData?.remarks?.requester &&
                            backeup?.PermitType == currentData?.keyPermitType
                        );
                    return true;
                },

                _switchMode: function (mode, preMode) {
                    const oUiModel = this.getView().getModel("uiModel");
                    // storeing the prev mode
                    oUiModel.setProperty(
                        "/ui/preMode",
                        preMode ? preMode : oUiModel.getProperty("/ui/mode")
                    );
                    // updating the current mode
                    oUiModel.setProperty("/ui/mode", mode);
                    oUiModel.refresh(true);
                },

                _crossApplicationNavigation: function (
                    sementicObject,
                    action,
                    params = {}
                ) {
                    if (!sementicObject || !action) return;

                    let CrossApplicationNavigation =
                        sap.ushell.Container.getService(
                            "CrossApplicationNavigation"
                        );
                    CrossApplicationNavigation.toExternal({
                        target: {
                            semanticObject: sementicObject,
                            action: action,
                        },
                        params: params,
                    }).then(function (sHref) {
                        // Place sHref somewhere in the DOM
                    });
                },

                _setDefaultValue: function () {
                    const oOwnComp = this.getOwnerComponent() || this.getView();
                    const oDocModel = oOwnComp.getModel("docModel");
                    const requestModel = oOwnComp.getModel("requestModel");

                    this._setDefaultDocModel();
                    // setting default value for remarks
                    requestModel.setProperty("/remarks", "");
                    requestModel.setProperty("/keyPermitType", "");

                    // clear the value state
                    this.byId("idPermitTypeCombobox").setValueState("None");
                    requestModel.refresh(true);
                },

                _setDefaultDocModel: function () {
                    const oOwnComp = this.getOwnerComponent() || this.getView();
                    const oDocModel = oOwnComp.getModel("docModel");
                    // setting default value for docs
                    oDocModel.setProperty("/", {
                        Document: [],
                        Doc: {
                            docType: "",
                            fileName: "",
                            file: "",
                        },
                        valueState: {
                            docType: "None",
                            file: "None",
                        },
                    });
                    oDocModel.refresh(true);
                },

                openConfirmationDialog: function (
                    sTitle,
                    sMessage,
                    fnOnConfirm,
                    fnOnCancel
                ) {
                    const oDialog = new sap.m.Dialog({
                        title: sTitle || "Confirmation",
                        type: "Message",
                        content: new sap.m.Text({ text: sMessage }),
                        beginButton: new sap.m.Button({
                            text: "Yes",
                            type: sap.m.ButtonType.Emphasized,
                            press: function () {
                                oDialog.close();
                                if (typeof fnOnConfirm === "function") {
                                    fnOnConfirm();
                                }
                            },
                        }),
                        endButton: new sap.m.Button({
                            text: "No",
                            press: function () {
                                oDialog.close();
                                if (typeof fnOnCancel === "function") {
                                    fnOnCancel();
                                }
                            },
                        }),
                        afterClose: function () {
                            oDialog.destroy();
                        },
                    });

                    oDialog.open();
                },
            }
        );
    }
);

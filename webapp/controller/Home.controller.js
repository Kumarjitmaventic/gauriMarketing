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
                        // Fetch user info
                        let oDataResponse = await this._OdataSynceRead(
                            "/UserSet('')",
                            oModel
                        );

                        // Update user info and role in UI model
                        uiModel.setProperty(
                            "/ui/loginUserInfo",
                            oDataResponse || nul
                        );
                        uiModel.setProperty(
                            "/ui/role",
                            oDataResponse?.Role || "default user"
                        );

                        uiModel.refresh();

                        // If new mode, set employee details in request model
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

                    // Get requestId from URL/startup parameters
                    let requestId = this._getRequestIdFromURL();

                    // Fetch request details if requestId exists
                    await this.fetchRequestDetailsAndUpdateModel(requestId);
                    oView.setBusy(false);
                },

                /**
                 * Fetches request details and updates models accordingly.
                 * Handles error and navigation if request not found.
                 */
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
                            // Read request details with expanded Document and Approval
                            requestDetails = await this._OdataSynceRead(
                                "/RequestSet('" + requestId + "')",
                                oModel,
                                {
                                    $expand: "Document,Approval",
                                }
                            );
                        }
                        // if request details not found return to list page
                        catch (error) {
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
                                        "requestlist"
                                    );
                                }.bind(this),
                            });
                        }

                        if (requestDetails) {
                            // keeping backup
                            uiModel.setProperty("/backup", JSON.parse(JSON.stringify(requestDetails)));
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
                            if (requestDetails.Status === "APR" || requestDetails.Status === "REJ")
                                requestModel.setProperty(
                                    "/updatedAt",
                                    requestDetails?.UpdatedAt
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

                /**
                 * Handles file download for selected items in the table.
                 * Downloads directly if FileContent is present, otherwise fetches from OData.
                 */

                onDownloadFiles(oEvent) {
                    //Fetching selected Items from table
                    let aSelectedItems =
                        this.byId("idProductsTable").getSelectedItems();

                    let oModel = this.getView().getModel("docModel");

                    if (aSelectedItems.length === 0)
                        return MessageBox.error("Please select at least one document to download.");

                    aSelectedItems.forEach((element) => {
                        var sPath = element.getBindingContextPath();
                        var docItem = oModel.getProperty(sPath);
                        // If FileContent is available, download directly
                        if (docItem.FileContent) {
                            this.downloadDOc(
                                docItem.FileContent,
                                docItem.FileName,
                                docItem.MimeType
                            );
                        } else {
                            // If FileContent is not available, fetch from OData service
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

                /**
                 * Generates and downloads the PDF for the current request status.
                 */

                onPressGenPdf: function () {
                    let reqId = this.getView()
                        .getModel("uiModel")
                        .getProperty("/ui/requestId");
                    // checking for request id and then fetching the pdf
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

                /**
                 * this function is used for confirmation dialog box
                 */
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

                /**
                 * Submits the request by updating its status and refreshing the view.
                 */

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

                /**
                * Handles delete button press, opens confirmation dialog and deletes request if confirmed.
                */
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
                                        routHistory ? "requestlist" : "Display"
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

                /**
                 * Opens the upload file dialog fragment.
                 */
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

                /**
                 * Switches to edit mode.
                 */
                onEditPress(oEvent) {
                    this._switchMode("edit");
                },

                /**
                 * Clears the form and resets to default values.
                 */
                onPressClear: function (oEvent) {
                    this._setDefaultValue();
                },


                /**
                 * Handles approver actions (approve/reject) with optional decision note.
                 */
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
                                let message = `Request successfully ${actionText == "Approve" ? "Approved" : "Rejected"}.`
                                MessageToast.show(message);
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

                /**
                * Handles approve/reject button press and opens confirmation dialog.
                */
                onPressActions: async function (oEvent) {
                    let actionText =
                        oEvent.getSource().getText() == "Approve"
                            ? "Approve"
                            : "Reject";

                    this.onActionConfirmDialogBox(actionText);
                },


                /**
                 * Opens a dialog for approver to enter a decision note.
                 */
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


                /**
                * Cancels the current edit and restores data from backup.
                */
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

                /**
                 * Closes the upload dialog and resets file input fields.
                 */
                onClose() {
                    if (this._oDialog) {
                        this._oDialog.close();
                    }
                    const oDocModel = this.getView().getModel("docModel");
                     const docType = oDocModel.getProperty("/Doc/docType");
                     oDocModel.setProperty("/Doc", {
                        docType: "",
                        Description:""
                    });
                    this.byId("fileUploader").setValue("");
                },

                /**
                 * Handles file selection change in the upload dialog.
                 */
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


                /**
                 * Handles delete file button press for selected files in the table.
                 */
                onDeleteFile() {

                    //Fetching selected Items from table
                    const oTable = this.byId("idProductsTable");
                    const aSelectedItems = oTable.getSelectedItems();
                    if (aSelectedItems.length === 0)
                        return MessageBox.error("Please select at least one document to delete.");


                    oTable.removeSelections();
                    this.onDeleteFiles(aSelectedItems);
                },

                /**
                 * 
                 * Deletes selected files from the document model.
                 */
                onDeleteFiles(aSelectedItems) {
                    if (aSelectedItems.length === 0) {
                        MessageToast.show(
                            "Please select at least one row to delete."
                        );
                        return;
                    }

                    const oModel = this.getView().getModel("docModel");
                    const uiModel = this.getView().getModel("uiModel");
                    const mode = uiModel.getProperty("/ui/mode");




                    let aDocuments = oModel.getProperty("/Document");

                    const removeIndexMap = {};
                    let Files = []

                    //Looping through selected items and retrieve the index to be removed
                    aSelectedItems.forEach(element => {
                        let sPath = element.getBindingContextPath();
                        let doucment = oModel.getProperty(sPath);
                        if (mode === "approver") {
                            if (!doucment.DocId) {
                                removeIndexMap[parseInt(
                                    element.getBindingContextPath().split("/").pop(),
                                    10
                                )] = true;
                            }
                            else {
                                Files.push(doucment.FileName);
                            }

                        }
                        else {
                            removeIndexMap[parseInt(
                                element.getBindingContextPath().split("/").pop(),
                                10
                            )] = true;
                        }
                    });


                    aDocuments = aDocuments.filter(
                        (_, idx) => !removeIndexMap[idx]
                    );

                    //if files are uploaded by the requester then it cannot be deleted
                    if (Files && Files.length > 0 && mode === "approver") {
                        MessageBox.information("'" + Files.join("', '") + "' files cannot be deleted as they are uploaded by the Requester");
                    }
                    oModel.setProperty("/Document", aDocuments);
                    oModel.refresh(true);
                },

                /**
                 * Adds a new file to the document model after reading its content.
                 */
                onAddFile(oEvent) {
                    const oDocModel = this.getView().getModel("docModel");
                    const oFile = oDocModel.getProperty("/Doc/file");
                    const docType = oDocModel.getProperty("/Doc/docType");
                    const aDocuments = oDocModel.getProperty("/Document");
                    const description = oDocModel.getProperty("/Doc/Description");

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
                    let oData = {
                        FileName: oFile.name,
                        FileContent: oFile,
                        DocType: docType,
                        Mimetype: oFile.type,
                        status: "Draft",
                        Description:description
                    };

                    aDocuments.push(oData);
                    if (this._oDialog) {
                        this._oDialog.close();
                    }
                    this.byId("fileUploader").setValue("");


                    oDocModel.setProperty("/Doc", {
                        docType: "",
                        fileName: "",
                        file: "",
                        Description:""
                    });
                    oDocModel.setProperty("/valueState", {
                       docType: "None",
                        file: "None",
                    }); 
                    oDocModel.refresh();
                },

                /**
                 * Handles selection change for document type combo box.
                 */

                onSelectionChange(oEvent) {
                    let oDocModel = this.getView().getModel("docModel");
                    if (oDocModel.getProperty("/Doc/docType") != "")
                        oDocModel.setProperty("/valueState/docType", "None");
                    const combTxt = oEvent.getSource().getSelectedItem()?.getProperty("text") || "";
                    oDocModel.setProperty("/Doc/Description", combTxt);
                },

                /**
                 * Handles selection change for permit type combo box.
                 */
                onSelectionPermit(oEvent) {
                    // this._setComboBoxText(oEvent, "empModel");
                    oEvent.oSource.setValueState("None");
                },

                /**
                 * Downloads a document given its binary content, file name, and mime type.
                 */
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

                /**
                * Saves the request and uploads documents.
                * Handles both create and update scenarios.
                */
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
                                        `/RequestSet('${requestId}')`,
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

                /**
                * Uploads all draft documents for the given requestId.
                * Returns a promise that resolves when all uploads are complete.
                */
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
                            const oHeaders = {
                                slug: element.FileName,
                                "Content-Type": element.Mimetype,
                                doctype: element.DocType,
                                description: element.Description,
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
                                    data: element.FileContent,
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
                    let deletedItemPayload = {
                        "RequestId": requestId,
                        "DocList": [

                        ]
                    };
                    backup?.Document?.results.forEach((item) => {
                        // if backup doc id not present in current doc id then its deleted
                        if (
                            !currentDocId[item.DocId] &&
                            item.DocId != undefined
                        )
                            deletedItemPayload.DocList.push({ "DocId": item.DocId });
                    });
                    uploadDocPayloads.push(that._OdataSyncPostReqSave("/DeletionDocumentSet", oModel, deletedItemPayload));
                    try {
                        let responses = await Promise.all(uploadDocPayloads);
                        return responses;
                    } catch (error) {
                        throw new Error("Faild to update the documetns");
                    }
                },

                /**
                 * Reads OData entity and returns a promise.
                 */
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

                /**
                 * Updates OData entity and returns a promise.
                 */
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

                /**
                 * Creates OData entity and returns a promise.
                 */
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


                /**
                 * Deletes OData entity and returns a promise.
                 */
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


                /**
                * Extracts the RequestId from the startup parameters in the component data.
                * Returns the RequestId if present, otherwise returns null.
                */
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


                /**
                 * Compares current request details with backup to check for changes.
                 */
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

                /**
                 * Switches the UI mode and stores the previous mode.
                 */
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

                /**
                 * Navigates to another Fiori app or page using cross-application navigation.
                 */
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

                /**
                * Sets default values for the form and document model.
                */
                _setDefaultValue: function () {
                    const oOwnComp = this.getOwnerComponent() || this.getView();
                    const oDocModel = oOwnComp.getModel("docModel");
                    const requestModel = oOwnComp.getModel("requestModel");

                    this._setDefaultDocModel();
                    // setting default value for remarks
                    requestModel.setProperty("/remarks", "");
                    requestModel.setProperty("/keyPermitType", "");
                    requestModel.setProperty("/updatedAt", "");

                    // clear the value state
                    this.byId("idPermitTypeCombobox").setValueState("None");
                    requestModel.refresh(true);
                },

                /**
                 * Sets default values for the document model.
                 */
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
                        fileType: "pdf,xlsx"
                    });
                    oDocModel.refresh(true);
                },

                /**
                 * Opens a generic confirmation dialog with customizable title, message, and callbacks.
                 */
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

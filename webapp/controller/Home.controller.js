

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
],
    function (Controller,
        MessageToast,
        MessageBox) {
        "use strict";

        return Controller.extend("marketingcampaign.zcrmktmarketingcampaign.controller.Home", {
            onInit: function () {
                var oView = this.getView();
                oView.setBusy(true);

                const oOwnComp = this.getOwnerComponent();
                const oDocModel = oOwnComp.getModel("docModel");
                const oModel = oOwnComp.getModel();
                const oEmpModel = oOwnComp.getModel("empModel");
                const uiModel = oOwnComp.getModel("uiModel");
                const that = this;

                oDocModel.setProperty("/Document", []);
                uiModel.setProperty("/show_Edit", false)
                uiModel.setProperty("/show_Sub", false)
                uiModel.setProperty("/show_Save", false);
                uiModel.setProperty("/show_Cancel", false);
                uiModel.setProperty("/show_Appr", false);
                uiModel.setProperty("/show_Download", false);

                let RequestId, sReqUrl;
                let createFlg = false;
                let oStartupParameters = this.getOwnerComponent().getComponentData().startupParameters;
                let sUrl = "/UserSet('')"

                if (oStartupParameters && oStartupParameters.RequestId) {

                    RequestId = oStartupParameters.RequestId[0]
                    sReqUrl = "/RequestSet('" + RequestId + "')"
                    this.getReqDet(sReqUrl, oModel, oDocModel, oEmpModel, uiModel);
                    uiModel.setProperty("/title", "Marketing Campaign Request(" + RequestId + ")");
                }
                else {
                    createFlg = true;
                    uiModel.setProperty("/title", "Marketing Campaign Create Request");
                }
                oModel.read(sUrl, {
                    success: function (oData) {
                        oEmpModel.setProperty("/empDetail", oData);
                        if (oData.Role === "Approver") {
                            uiModel.setProperty("/show_Appr", true);
                            uiModel.setProperty("/show_Edit", true);
                        }
                        else if (oData.Role === "Marketing" && createFlg)
                            uiModel.setProperty("/show_Save", true);
                        oView.setBusy(false);
                    },
                    error: function (oError) {
                        oView.setBusy(false);
                    }
                });
            },

            getReqDet(sReqUrl, oModel, oDocModel, oEmpModel, uiModel) {
                oModel.read(sReqUrl, {
                    success: function (oData) {
                        if (oData.Status === "Draft") {
                            uiModel.setProperty("/show_Edit", true)
                            uiModel.setProperty("/show_Sub", true)
                            uiModel.setProperty("/show_Download", true)
                        }
                        uiModel.setProperty("/Editable", false);
                        oDocModel.setProperty("/comment", oData.Remarks)
                        oDocModel.setProperty("/keyPermitType", oData.PermitType)

                    },
                    error: function (oError) {
                        MessageBox.error("Error fetching request details.");
                        uiModel.setProperty("/Editable", false)
                    }
                });
            },

            onDownloadFiles(oEvent) {

                //Fetching selected Items from table
                var aSelectedItems = this.byId("idProductsTable").getSelectedItems()
                // if (aSelectedItems.length === 0) {
                //     MessageToast.show("Please select at least one row to delete.");
                //     return;
                // }
                var that = this;
                var oDModel =
                    new sap.ui.model.odata.ODataModel("/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV")

                var oModel = this.getView().getModel("docModel");
                // const sPath = "/DocumentSet('FOL50000000000111EXT50000000000237')/$value"
                const sPath = "/RequestPdfSet('111')/$value"
                
                // oDModel.read(sPath, {
                //     success: function (data, response) {
                //         const mimeType=response.headers['Content-Type'];
                //         const fileName=eval(response.headers['content-disposition'].split("=")[1])
                //         that.downloadDOc(response.body, fileName, mimeType)
                //         var blob = new Blob([response], { type: mimeType });

                //         // Create an Object URL for the Blob and open it in a new tab
                //         var url = URL.createObjectURL(blob);
                //         var newTab = window.open(url, '_blank');

                //     },
                //     error: function (oError) {
                //         MessageBox.error("Error downloading file.");
                //     }
                // });
                //looping through the selected items for downloading each file

                aSelectedItems.forEach(element => {
                    var sPath = element.getBindingContextPath();
                    var docItem = oModel.getProperty(sPath)

                    if (docItem.FileContent) {
                        this.downloadDOc(docItem.FileContent, docItem.FileName, docItem.MimeType)
                    }
                    else {

                        $.ajax({
                            url: "/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV/DocumentSet('FOL38000000000004EXT50000000000274')/$value",
                            type: "GET",
                            xhrFields: {
                                responseType: "blob" // Ensures binary data handling
                            },
                            success: function (blob) {
                                var url = URL.createObjectURL(blob); // Convert blob to URL
                                window.open(url); // Open the file in a new tab
                            },
                            error: function (xhr, status, error) {
                                console.error("Error fetching stream:", error);
                            }
                        });
                    }

                });
                console.log(oEvent)
            },
            onSubReq() {
                var oDialog = new sap.m.Dialog({
                    title: "Confirmation",
                    type: "Message",
                    content: new sap.m.Text({ text: "Do you want to submit the request" }),
                    beginButton: new sap.m.Button({
                        text: "OK",
                        press: function () {
                            this.onSubmit();
                            oDialog.close();
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            oDialog.close();
                        }
                    }),
                    afterClose: function () {
                        oDialog.destroy();
                    }
                })

                oDialog.open();

            },

            onDownPress() {

            },
            onSubmit() {
                const uiModel = this.getView().getModel("uiModel");
                const oModel = this.getView().getModel();
                const oDocModel = this.getView().getModel("docModel")
                const oEmpModel = this.getView().getModel("empModel")
                const RequestId = uiModel.getProperty("/RequestId");
                const that = this;
                const commt = oDocModel.getProperty("/comment")
                const perType = oEmpModel.getProperty("/cmboxText");

                const oPayload = {
                    PermitType: perType,
                    Remarks: commt,
                    Status: "Initiated"

                }
                var sUrl = "/RequestSet('" + RequestId + "')";
                oModel.update(sUrl, oPayload, {
                    success: function (oData, response) {
                        uiModel.setProperty("/show_Edit", false)
                        uiModel.setProperty("/show_Sub", false)
                        uiModel.setProperty("/show_Save", false);
                        uiModel.setProperty("/show_Cancel", false);
                        uiModel.setProperty("/show_Appr", false);
                        uiModel.setProperty("/Editable", false);
                        that.onClear();
                        MessageBox.success("Request Submitted Sucessfully");
                    },
                    error: function (oError) {
                        MessageBox.error("Could not submit the request");
                    }
                });
            },
            onUploadFiles() {

                if (!this._oDialog) {
                    this._oDialog = sap.ui.xmlfragment(this.getView().getId(), "marketingcampaign.zcrmktmarketingcampaign.fragments.uploadFile", this);
                    this.getView().addDependent(this._oDialog);
                }
                this._oDialog.open();
            },
            onEditPress() {
                const uiModel = this.getView().getModel("uiModel");
                const oEmpModel = this.getView().getModel("empModel");
                uiModel.setProperty("/Editable", true);
                uiModel.setProperty("/show_Edit", false)
                uiModel.setProperty("/show_Sub", false)
                uiModel.setProperty("/show_Save", true);
                uiModel.setProperty("/show_Cancel", true);
            },
            onCancelPress() {
                const oEmpModel = this.getView().getModel("empModel");
                const oDocModel = this.getView().getModel("docModel");
                const uiModel = this.getView().getModel("uiModel");
                let aDocuments = oDocModel.getProperty("/Document");
                uiModel.setProperty("/Editable", false);
                uiModel.setProperty("/show_Edit", true)
                uiModel.setProperty("/show_Sub", true)
                uiModel.setProperty("/show_Save", false);
                uiModel.setProperty("/show_Cancel", false);
                const filteredData = aDocuments.filter(item => item.status !== "Draft");
                aDocuments = filteredData;
            },
            onClose() {
                if (this._oDialog) {
                    this._oDialog.close();
                }
                this.byId("comboBox1").setSelectedKey("")
                this.byId("fileUploader").setValue("")
            },
            handleValueChange(oEvent) {
                const oModel = this.getView().getModel("docModel");
                oModel.setProperty("/Doc", oEvent.getSource().oFileUpload.files[0])
            },
            onDeleteFiles(aSelectedItems) {
                // if (aSelectedItems.length === 0) {
                //     MessageToast.show("Please select at least one row to delete.");
                //     return;
                // }
                // const that = this;
                // const oModel = this.getView().getModel("docModel");
                // const aDocuments = oModel.getProperty("/Document");
                // let ind = 0;
                // //looping each Items and removing from model
                // aSelectedItems.forEach((element, ind) => {
                //     var sPath = element.getBindingContextPath();
                //     var docId = (sPath.split("/")).slice(-1)[0];
                //     aDocuments.splice(docId - ind, 1);
                //     ind++;
                // });
                // oModel.refresh(true);
                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select at least one row to delete.");
                    return;
                }
                const oModel = this.getView().getModel("docModel");
                let aDocuments = oModel.getProperty("/Document");
                const indicesToRemove = aSelectedItems.map(item =>
                    parseInt(item.getBindingContextPath().split("/").pop(), 10)
                );
                aDocuments = aDocuments.filter((_, idx) => !indicesToRemove.includes(idx));
                oModel.setProperty("/Document", aDocuments);
                oModel.refresh(true);
            },
            onDeleteFile() {
                //Fetching selected Items from table
                const oTable = this.byId("idProductsTable");
                const aSelectedItems = oTable.getSelectedItems();
                oTable.removeSelections()
                this.onDeleteFiles(aSelectedItems)
            },
            onAddFile(oEvent) {
                const oEmpModel = this.getView().getModel("empModel");
                var oDModel =
                    new sap.ui.model.odata.ODataModel("/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV")

                const oModel = this.getView().getModel("docModel");
                const oFile = oModel.getProperty("/Doc");
                const aDocuments = oModel.getProperty("/Document");
                const oComboTxt = oModel.getProperty("/cmboxText");
                const that = this;
                if (!oFile) {
                    MessageToast.show("Please select a file first.");
                    return;
                }
                if (!oComboTxt) {
                    MessageToast.show("Please select a Doc Type.");
                    return;
                }

                var reader = new FileReader();
                reader.onload = function (e) {
                    // let RequestId = "000000000085"; // that.getView().getModel("uiModel").getProperty("/RequestId");
                    // let sUrl="/RequestSet('"+RequestId+"')/Document"


                    const binaryArray = e.target.result;
                    const blob = new Blob([binaryArray], { type: oFile.type });
                    const mimeType = oFile.type // Default to binary if type is not available
                    const oModel = this.getView().getModel("docModel");
                    const role = oEmpModel.getProperty("/empDetail/Role");
                    var formData = new FormData();
                    formData.append("file", oFile);
                    let oData = {
                        FileName: oFile.name,
                        FileContent: blob,
                        DocType: oComboTxt,
                        Mimetype: mimeType,
                        status: "Draft"
                    };


                    aDocuments.push(oData);
                    oModel.refresh(true);
                    if (this._oDialog) {
                        this._oDialog.close();
                    }
                    this.byId("comboBox1").setSelectedKey("")
                    this.byId("fileUploader").setValue("")
                }.bind(this);
                reader.readAsArrayBuffer(oFile);
            },
            _setComboBoxText(oEvent, sModelName) {
                const oModel = this.getView().getModel(sModelName);
                const combTxt = oEvent.getSource().getSelectedItem()?.getProperty("text") || "";
                oModel.setProperty("/cmboxText", combTxt);
            },
            onSelectionChange(oEvent) {
                this._setComboBoxText(oEvent, "docModel");
            },
            onSelectionPermit(oEvent) {
                this._setComboBoxText(oEvent, "empModel");
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
            onClear() {
                const oTable = this.byId("idProductsTable");
                const oEmpModel = this.getView().getModel("empModel");
                const oDocModel = this.getView().getModel("docModel");
                oTable.removeSelections()
                oDocModel.setProperty("/Document", []);
                this.byId("comboBox1").setSelectedKey("")
                this.byId("_IDGenComboBox").setSelectedKey("")
                this.byId("fileUploader").setValue("")

            },
            onPressSave() {
                // // Get the current URL
                // let url = new URL(window.location.href);

                // // Add or update the RequestId parameter
                // url.searchParams.set('RequestId', '100002');

                // // Reload the page with the updated URL
                // window.location.href = url.toString();

                // If you want to reload the page with the new parameter, use:
                // window.location.href = newUrl;
                // var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                // oRouter.navTo("RouteHome", {
                //     RequestId: "0000021"
                // });
                const oModel = this.getView().getModel();
                const oDocModel = this.getView().getModel("docModel"); // or use a named model
                const oEmpModel = this.getView().getModel("empModel");
                const uiModel = this.getView().getModel("uiModel");
                const perType = oEmpModel.getProperty("/cmboxText");

                if (!perType) {
                    MessageToast.show("Please select a Permit Type.");
                    return;
                }

                const commt = oDocModel.getProperty("/comment");
                var that = this
                let oDoc;



                const aDocuments = oDocModel.getProperty("/Document");
                let aDocs = [];

                aDocuments.forEach(element => {
                    if (element.status === "Draft")
                        oDoc = {
                            Filename: element.FileName,
                            Mimetype: element.Mimetype,
                            FileContent: element.FileContent,
                            DocType: element.DocType
                        }
                    aDocs.push(oDoc)
                });


                const oPayload = {
                    PermitType: perType,
                    Remarks: commt,
                    Status: "Draft"
                };
                // that.createDocuments(aDocs);
                // oModel.setDeferredGroups(["batchCreate"]);
                const RequestId = uiModel?.getProperty("/RequestId");
                that.createDocuments(aDocs)
                // if (!RequestId) {
                //     that.createDocuments(aDocs);
                // }
                // else {
                //     oModel.create("/RequestSet", oPayload, {
                //         success: function (oData, response) {
                //             that.getView().getModel("empModel").setProperty("/empDetail/Editable", false);
                //             uiModel.setProperty("/RequestId", oData.RequestId);
                //             uiModel.setProperty("/title", "Marketing Campaign Request(" + oData.RequestId + ")");
                //             MessageBox.success("Request created successfully this is your Request Id: " + oData.RequestId);
                //             if (aDocs.length > 0) {
                //                 that.createDocuments(aDocs);
                //             }
                //             else {
                //                 uiModel.setProperty("/Editable", false);
                //                 uiModel.setProperty("/show_Edit", true)
                //                 uiModel.setProperty("/show_Sub", true)
                //                 uiModel.setProperty("/show_Save", false);
                //                 uiModel.setProperty("/show_Cancel", false);
                //             }
                //             // MessageToast.show("Request created successfully!");
                //             // that.byId("comboBox1").setSelectedKey("")
                //             // oDocModel.setProperty("/comment", "");
                //             // that.onClear();
                //         },
                //         error: function (oError) {
                //             MessageBox.error("Error creating request.");
                //         }
                //     });
                // }


            },
            createDocuments(aDocs) {
                const oModel = this.getView().getModel();
                const uiModel = this.getView().getModel("uiModel");
                const oDocModel = this.getView().getModel("docModel");
                const RequestId = uiModel.getProperty("/RequestId");
                let aPromises = [];
                aDocs.forEach((element, index) => {
                    var formData = new FormData();
                    formData.append("file", element.FileContent, element.Filename);
                    const csrfToken = oModel.getSecurityToken()
                    const oHeaders = {
                        'slug': element.Filename,
                        'Content-Type': element.Mimetype,
                        'doctype': element.DocType,
                        'X-CSRF-Token': csrfToken
                    }
                    const promise = new Promise((resolve, reject) => {
                        $.ajax({
                        url: "/sap/opu/odata/sap/ZCRM_MKT_MARKETING_CAMPAIGN_SRV/RequestSet('"+RequestId+"')/Document",
                        type: "POST",
                        headers: oHeaders,
                        processData: false,
                        contentType: false,
                        data: formData,
                        success: function (oData, Response) {
                            sap.m.MessageToast.show("File uploaded successfully!");
                        },
                        error: function (err) {
                            console.error("Upload failed:", err);
                        }
                    });
                    });
                    aPromises.push(promise);

                });
                Promise.all(aPromises).then(() => {

                    uiModel.setProperty("/Editable", false);
                    uiModel.setProperty("/show_Edit", true)
                    uiModel.setProperty("/show_Sub", true)
                    uiModel.setProperty("/show_Save", false);
                    uiModel.setProperty("/show_Cancel", false);
                    oDocModel.setProperty("/comment", "");

                }).catch((error) => {
                    MessageBox.error("Error creating documents.");
                });

            },
            onAppReq(oEvent) {
                // var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                // oRouter.navTo("RouteHome", {
                //     RequestId: "0000021"
                // });
                const clcButt = oEvent.getSource().getProperty("text")
                if (clcButt === "Approve Request") {
                    const Action = "X"
                }
                else {
                    const Action = ""
                }
                const oModel = this.getView().getModel();
                const oDocModel = this.getView().getModel("docModel");
                const commt = oDocModel.getProperty("/comment");
                var that = this
                const aDocuments = oDocModel.getProperty("/Document");
                let aDocs = [];
                let oStartupParameters = this.getOwnerComponent().getComponentData().startupParameters;
                if (oStartupParameters && oStartupParameters.RequestId) {
                    const RequestId = oStartupParameters.RequestId[0]
                }
                else {
                    MessageBox.error("Error creating request.");
                }
                aDocuments.forEach(element => {
                    if (element?.role && element.role === "Approver") {
                        let oDoc = {
                            Filename: element.FileName,
                            Mimetype: element.mimeType,
                            FileContent: element.FileContent,
                            DocType: element.DocType
                        }
                        aDocs.push(oDoc)
                    }
                });
                const oPayload = {
                    RequestId: RequestId,
                    Action: Action,
                    Remark: commt,
                    Document: aDocs
                };
                this.onCreateApproval(oPayload)



            },
            onCreateApproval(oPayload) {
                const oModel = this.getView().getModel()
                oModel.create("/RequestSet", oPayload, {
                    success: function (oData, response) {
                        MessageToast.show("Request Approved successfully!");

                    },
                    error: function (oError) {
                        MessageBox.error("Error creating request.");
                    }
                });

            }
        });
    });

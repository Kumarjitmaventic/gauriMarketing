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

                // Set the entire app to busy
                oView.setBusy(true);
                const oOwnComp = this.getOwnerComponent();
                const oDocModel = oOwnComp.getModel("docModel");
                oDocModel.setProperty("/Document", []);
                const oModel = oOwnComp.getModel();
                const oEmpModel = oOwnComp.getModel("empModel");
                let role;
                let RequestId
                let oStartupParameters = this.getOwnerComponent().getComponentData().startupParameters;
                let sUrl = "/UserSet('')"
                if (oStartupParameters && oStartupParameters.RequestId) {

                    RequestId = oStartupParameters.RequestId[0]
                    sUrl = "/UserSet(" + RequestId + ")"
                }
                //Fetching the employee detail from the table

                oModel.read(sUrl, {
                    success: function (oData) {
                        oEmpModel.setProperty("/empDetail", oData)
                        role = oData.Role
                        role === "Marketing" && !RequestId ? role = "Marketing" : role === "Approver" ? role = "Approver" : role = "Employee"
                        oEmpModel.setProperty("/empDetail/Role", role);
                        oView.setBusy(false);
                    },
                    error: function (oError) {
                        oView.setBusy(false);
                    }
                });
            },
            onDownloadFiles(oEvent) {
                //Fetching selected Items from table
                var aSelectedItems = this.byId("idProductsTable").getSelectedItems()
                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select at least one row to delete.");
                    return;
                }
                var that = this;
                var oModel = this.getView().getModel("docModel");
                //looping through the selected items for downloading each file
                aSelectedItems.forEach(element => {
                    var sPath = element.getBindingContextPath();
                    var docItem = oModel.getProperty(sPath)
                    this.downloadDOc(docItem.FileContent, docItem.FileName, docItem.MimeType)
                });
                console.log(oEvent)
            },
            onUploadFiles() {

                if (!this._oDialog) {
                    this._oDialog = sap.ui.xmlfragment(this.getView().getId(), "marketingcampaign.zcrmktmarketingcampaign.fragments.uploadFile", this);
                    this.getView().addDependent(this._oDialog);
                }
                this._oDialog.open();
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
                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select at least one row to delete.");
                    return;
                }
                const that = this;
                const oModel = this.getView().getModel("docModel");
                const aDocuments = oModel.getProperty("/Document");
                let ind = 0;
                //looping each Items and removing from model
                aSelectedItems.forEach((element, ind) => {
                    var sPath = element.getBindingContextPath();
                    var docId = (sPath.split("/")).slice(-1)[0];
                    aDocuments.splice(docId - ind, 1);
                    ind++;
                });
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
                    //Retrieving base 64 and mimetype
                    const base64String = e.target.result.split(",")[1];
                    const mimeType = e.target.result.split(";")[0].replace('data:', '')
                    const oModel = this.getView().getModel("docModel");
                    const role = oEmpModel.getProperty("/empDetail/role");
                    let oData = {
                        FileName: oFile.name,
                        FileContent: base64String,
                        DocType: oComboTxt,
                        mimeType: mimeType
                    };
                    if (role === "Approver") {
                        oData = {
                            FileName: oFile.name,
                            FileContent: base64String,
                            DocType: oComboTxt,
                            mimeType: mimeType,
                            role: "Approver"
                        };
                    }

                    aDocuments.push(oData);
                    oModel.refresh(true);
                    if (this._oDialog) {
                        this._oDialog.close();
                    }
                    this.byId("comboBox1").setSelectedKey("")
                    this.byId("fileUploader").setValue("")
                }.bind(this);
                reader.readAsDataURL(oFile);
            },
            onSelectionChange(oEvent) {
                var oModel = this.getView().getModel("docModel");
                var combTxt = oEvent.getSource().getSelectedItem().getProperty("text");
                oModel.setProperty("/cmboxText", combTxt);
            },
            onSelectionPermit(oEvent) {
                var oModel = this.getView().getModel("empModel");
                var combTxt = oEvent.getSource().getSelectedItem().getProperty("text");
                oModel.setProperty("/cmboxText", combTxt);
            },
            downloadDOc: function (base64String, fileName, mimeType) {
                // Decode Base64
                const byteCharacters = atob(base64String);
                const byteNumbers = new Array(byteCharacters.length);

                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                //converting binary to Blob
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });

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
            onSubReq() {
                const oModel = this.getView().getModel();
                const oDocModel = this.getView().getModel("docModel"); // or use a named model
                const oEmpModel = this.getView().getModel("empModel");
                const perType = oEmpModel.getProperty("/cmboxText");
                const commt = oDocModel.getProperty("/comment");
                var that = this
                const aDocuments = oDocModel.getProperty("/Document");
                let aDocs = [];

                aDocuments.forEach(element => {
                    let oDoc = {
                        Filename: element.FileName,
                        Mimetype: element.mimeType,
                        FileContent: element.FileContent,
                        DocType: element.DocType
                    }
                    aDocs.push(oDoc)
                });


                const oPayload = {
                    PermitType: perType,
                    Remarks: commt,
                    Document: aDocs
                };

                oModel.create("/RequestSet", oPayload, {
                    success: function (oData, response) {
                        MessageToast.show("Request created successfully!");
                        that.byId("comboBox1").setSelectedKey("")
                        oDocModel.setProperty("/comment", "");
                        that.onClear();
                    },
                    error: function (oError) {
                        MessageBox.error("Error creating request.");
                    }
                });

            },
            onAppReq(oEvent) {
                const clcButt=oEvent.getSource().getProperty("text")
                if(clcButt==="Approve Request"){
                    const Action ="X"
                }
                else{
                    const Action =""
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
                aDocuments.forEach(element => {
                    if (element?.role && element.role === "Approve") {
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
            onCreateApproval(oPayload){
                const oModel=this.getView().getModel()
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

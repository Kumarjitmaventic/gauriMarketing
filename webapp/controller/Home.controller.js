sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
],
    function (Controller, MessageToast) {
        "use strict";

        return Controller.extend("marketingcampaign.zcrmktmarketingcampaign.controller.Home", {
            onInit: function () {
                const oOwnComp=this.getOwnerComponent();
                const oDocModel = oOwnComp.getModel("docModel");
                oDocModel.setProperty("/Document", []);
                const oModel=oOwnComp.getModel();
                const oEmpModel=oOwnComp.getModel("empModel");
                //Fetching the employee detail from the table
                const sUrl="/UserSet('')"
                oModel.read(sUrl, {
                    success: function (oData) {
                        oEmpModel.setProperty("/empDetail",oData)
                    },
                    error: function (oError) {
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
                var oModel = this.getView().getModel("docModel");
                oModel.setProperty("/Doc", oEvent.getSource().oFileUpload.files[0])
            },
            onDeleteFile() {
                //Fetching selected Items from table
                const oTable = this.byId("idProductsTable");
                const aSelectedItems = oTable.getSelectedItems();
                oTable.removeSelections()
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
            onAddFile(oEvent) {
                var oModel = this.getView().getModel("docModel");
                var oFile = oModel.getProperty("/Doc");
                var aDocuments = oModel.getProperty("/Document");
                var oComboTxt = oModel.getProperty("/cmboxid");
                var that = this;
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
                    const mimeType = e.target.result.split(";")[0]
                    const oModel = this.getView().getModel("docModel");
                    const oData = {
                        FileName: oFile.name,
                        FileContent: base64String,
                        DocType: oComboTxt,
                        mimeType: mimeType
                    };
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
                oModel.setProperty("/cmboxid", combTxt);
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
            }
        });
    });

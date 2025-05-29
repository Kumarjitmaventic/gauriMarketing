sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
],
    function (Controller,MessageToast) {
        "use strict";

        return Controller.extend("marketingcampaign.zcrmktmarketingcampaign.controller.Home", {
            onInit: function () {
                var oModel = this.getOwnerComponent().getModel("docModel")
                oModel.setProperty("/Document", [])
            },
            onDownloadFiles(oEvent) {
                var aSelectedItems = this.byId("idProductsTable").getSelectedItems()
                 if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select at least one row to delete.");
                    return;
                }
                var that = this;
                var oModel = this.getView().getModel("docModel");
                aSelectedItems.forEach(element => {
                    var sPath = element.getBindingContextPath();
                    var docItem = oModel.getProperty(sPath)
                    this.downloadDOc(docItem.FileContent, docItem.FileName, docItem.MimeType)
                });
                console.log(oEvent)
            },
            onUploadFiles() {

                if (!this._oDialog) {
                    this._oDialog = sap.ui.xmlfragment(this.getView().getId(),"marketingcampaign.zcrmktmarketingcampaign.fragments.uploadFile", this);
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
                var aSelectedItems = this.byId("idProductsTable").getSelectedItems()
                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select at least one row to delete.");
                    return;
                }
                var oModel = this.getView().getModel("docModel");
                var aDocuments=oModel.getProperty("/Document")
                aSelectedItems.forEach(element => {
                    var sPath = element.getBindingContextPath();
                    var docId=(sPath.split("/")).slice(-1)[0];
                    aDocuments.splice(docId,1)
                });
                oModel.refresh(true);
            },
            onAddFile(oEvent) {
                var oModel = this.getView().getModel("docModel");
                var oFile = oModel.getProperty("/Doc");
                var aDocuments = oModel.getProperty("/Document");
                var oComboTxt = oModel.getProperty("/cmboxid");
                var that = this;
                if (!oFile ) {
                    MessageToast.show("Please select a file first.");
                    return;
                }
                if (!oComboTxt ) {
                    MessageToast.show("Please select a Doc Type.");
                    return;
                }

                var reader = new FileReader();
                reader.onload = function (e) {
                    var base64String = e.target.result.split(",")[1];
                    var mimeType = e.target.result.split(";")[0]
                    var oModel = this.getView().getModel("docModel");
                    var oData = {
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
                const byteCharacters = atob(base64String); // Decode Base64
                const byteNumbers = new Array(byteCharacters.length);

                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }

                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });

                // Create download link
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;

                document.body.appendChild(link);
                link.click();

                // Cleanup
                document.body.removeChild(link);
            }
        });
    });

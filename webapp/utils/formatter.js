sap.ui.define(["sap/ui/core/format/DateFormat"], function (DateFormat) {
    "use strict";

    return {
        isSaveButtonVisiable: function (sMode) {
            return sMode === "new";
        },

        isRemarkeEditableForRequester: function (uiModel) {
            return (uiModel.mode === "new" || uiModel.mode === "edit") &&
                uiModel.role === "Requester"
                ? true
                : false;
        },
        getDocTypeText: function (sKey) {
            const oMap = {
                OFV: "Offer Visual",
                PCL: "Price List Excel File",
                PZL: "Prize List Excel File",
                PZI: "Prize Invoices",
                COD: "Coupon Design",
                CCC: "Charge Cost Center",
                GEN: "Generated PDF",
                PAR: "Payment receipt",
                PEC: "Permit copy"
            };
            return oMap[sKey] || sKey || ""; // fallback to key or blank
        },
        getRequestStatusText: function (sStatusKey, requestId) {
            const oStatusMap = {
                DRF: "Draft",
                INI: "Initiated",
                PCM: "Pending with Commercial Operations Manager",
                PMH: "Pending with Marketing Head",
                PGM: "Pending with GA Immigration & Admin Manager",
                PGS: "Pending with GA Specialist",
                APR: "Approved",
                REJ: "Rejected",
                NEW: "New"
            };
            return (sStatusKey == "NEW")? "Create new marketing campaign request : " : `Marketing Campaign Request :  ${requestId} | ${oStatusMap[sStatusKey]}` 
        },

        getPageTitle: function (sStatusKey, requestId, updatedAt){
            if(updatedAt){
                // Convert to JS Date if it's a string
                const dateObj = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;

                // Use user's locale settings
                const oDateFormat = DateFormat.getDateInstance({
                    style: "medium" // or use pattern: "dd.MM.yyyy" etc.
                });

                var date =  oDateFormat.format(dateObj);
            }
            

            const oStatusMap = {
                DRF: "Draft",
                INI: "Initiated",
                PCM: "Pending with Commercial Operations Manager",
                PMH: "Pending with Marketing Head",
                PGM: "Pending with GA Immigration & Admin Manager",
                PGS: "Pending with GA Specialist",
                APR: "Approved",
                REJ: "Rejected",
                NEW: "New"
            };
            return (sStatusKey == "NEW")? "Create new marketing campaign request : " : `Marketing Campaign Request :  ${requestId} | ${oStatusMap[sStatusKey]} ${date? " | " + date : ""}` 
       
        }
    };
});

sap.ui.define(["sap/ui/core/format/DateFormat"], function (DateFormat) {
    "use strict";
    let statusMap = {
        DRF: "Draft",
        INI: "Initiated",
        PCM: "Pending with Commercial Operations Manager",
        PMH: "Pending with Marketing Head",
        PGM: "Pending with GA Immigration & Admin Manager",
        PGS: "Pending with GA Specialist",
        APR: "Approved",
        REJ: "Rejected",
        NEW: "New",
        CFR: "Clarification Required",
    };
    let docTypeMap = {
        OFV: "Offer Visual",
        PCL: "Price List Excel File",
        PZL: "Prize List Excel File",
        PZI: "Prize Invoices",
        COD: "Coupon Design",
        CCC: "Charge Cost Center",
        GEN: "Generated PDF",
        PAR: "Payment receipt",
        PEC: "Permit copy",
        OTH: "Others",
    };
    return {
        isSaveButtonVisiable: function (sMode) {
            return sMode === "new";
        },
        isClarificationProvBtnVisiable: function (uiModel) {
            return uiModel?.mode === "draft" && uiModel?.requestStatus === "CFR";
        },
        isSubmitBtnVisiable: function (uiModel) {
            return uiModel?.mode === "draft" && uiModel?.requestStatus != "CFR";
        },
        isRejectBtnVisiable: function (uiModel) {
            if(uiModel?.mode === "approver" && uiModel?.role == "Approver" && uiModel?.requestStatus == "PGS")
                return true;
            else if(uiModel?.mode != "new" && uiModel?.mode != "edit" && uiModel?.role == "Requester" && uiModel?.requestStatus == "CFR")
                return true;
            else return false;
            // return uiModel?.mode === "view" && uiModel?.requestStatus != "CFR";
        },
        isDeleteButtonVisiable: function (uiModel){
            return uiModel?.mode === "draft" && uiModel?.requestStatus !== "CFR";
        },

        isRemarkeEditableForRequester: function (uiModel) {
            return (uiModel.mode === "new" || uiModel.mode === "edit") &&
                uiModel.role === "Requester"
                ? true
                : false;
        },
        getDocTypeText: function (sKey) {
            return docTypeMap[sKey] || sKey || ""; // fallback to key or blank
        },
        getRequestStatusText: function (sStatusKey, requestId) {
            return sStatusKey == "NEW"
                ? "Create new marketing campaign request : "
                : `Marketing Campaign Request :  ${requestId} | ${statusMap[sStatusKey]}`;
        },

        getPageTitle: function (sStatusKey, requestId, updatedAt) {
            if (updatedAt) {
                // Convert to JS Date if it's a string
                const dateObj =
                    typeof updatedAt === "string"
                        ? new Date(updatedAt)
                        : updatedAt;

                // Use user's locale settings
                const oDateFormat = DateFormat.getDateInstance({
                    style: "medium", // or use pattern: "dd.MM.yyyy" etc.
                });

                var date = oDateFormat.format(dateObj);
            }
            return sStatusKey == "NEW"
                ? "Create new marketing campaign request : "
                : `Marketing Campaign Request :  ${requestId} | ${
                      statusMap[sStatusKey]
                  } ${date ? " | " + date : ""}`;
        },
    };
});

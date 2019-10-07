sap.ui.define([], function () {
	"use strict";

	return {
		/**
		 * Rounds the currency value to 2 digits
		 *
		 * @public
		 * @param {string} sValue value to be formatted
		 * @returns {string} formatted currency value with 2 digits
		 */
		currencyValue: function (sValue) {
			if (!sValue) {
				return "";
			}

			return parseFloat(sValue).toFixed(2);
		},

		reportType: function (sPath) {
			const oModel = this.getModel();
			let sText = "";

			try {
				const oPickList = oModel.oData[sPath];
				sText = oPickList.label_pt_BR;
			} catch (error) {
				// nothing to do
			}

			return sText;
		},

		expenseType: function (sExpenseType, oType) {
			if (sExpenseType === "ADT") {
				return "Adiantamento";
			}

			
			var sText = sExpenseType;
			var oModel = this.getModel();

			try {
				sText = oType.label_defaultValue;
			} catch (error) {
				// nothing to do
			}

			return sText;
		},

		status: function (sReportStatus, sReportStatusPath, sExternalCode) {

			if (sReportStatus == "P") {
				return "Rascunho";
			}

			const oState = this.getOwnerComponent().getState("Report");
			return oState._getReportStatus(sExternalCode);
		},

		fileName: function (sExternalCode, oAttachment) {

			if (!oAttachment) {
				return "";
			}

			var aItems = this.ReportState.data.Report.Items;

			var iIndex = aItems
				.map(function (oItem) {
					return oItem.externalCode;
				})
				.indexOf(sExternalCode);

			var oAttachment = this.ReportState.getAttachment(iIndex, oAttachment);
			return oAttachment.fileName;

		}

	};
});
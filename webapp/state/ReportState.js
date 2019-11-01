sap.ui.define([
	"../model/BaseObject",
	"../model/Report",
	"../model/Attachment",
	"../libs/observable-slim"
], function (BaseObject, Report, Attachment, obs) {
	"use strict";
	var ReportState = BaseObject.extend("hrst.TravelExpenses.state.ReportState", {
		constructor: function (oService) {

			this.data = {
				Report: new Report(),
				display: true
			};
			this.ReportService = oService;
			BaseObject.call(this, {
				isState: true
			});
			this.costCenter = null;

		},

		createReport: function (parameters) {
			var oReport = new Report(null, parameters);
			this.data.Report = ObservableSlim.create(oReport, true, (aChanges) => {
				//this._onReportChange(oReport, aChanges)
			});
			this.data.display = false;
		},

		getReport: async function (id) {
			return await this.ReportService.getReport(id).then((result) => {
				const oReport = new Report(result.data);
				this.data.Report = oReport;
				this.data.Report.status = this._getReportStatus(id);
				this.data.display = true;;
				if (result.data.cust_adtNav) {
					this.setItemFromAdt(result.data.cust_adtNav);
					this.updateModel();
				}
				return this.data.Report;
			});
		},

		_getReportStatus: async function (sId) {
			return await this.ReportService.getReportStatus(sId).then((result) => {
				try {
					switch (result.data.results[0].status) {
					case "REJECTED":
						return "Rejeitado";
						break;
					case "COMPLETED":
						return "Aprovado";
						break;
					case "PENDING":
						return "Aguardando Aprovação";
						break;
					}
				} catch (e) {
					return "Aguardando Aprovação";
				}
			});
		},

		onReportChange: function () {
			const oReport = this.data.Report;
			oReport.propagateChangesToItems();
			this.updateModel();
		},

		setItemFromAdt: function (oAdt) {
			const oReport = this.data.Report;

			let aItems = oReport.getItems();
			jQuery.each(aItems, (key, value) => {
				if (value.cust_type === "ADT") {
					aItems.splice(key, 1);
				}
			});;
			aItems.push({
				cust_datum: oAdt.cust_datum,
				cust_value: oAdt.cust_valor * -1,
				cust_type: "ADT"
			});

			oReport.setItems(aItems);

		},

		createReportItem: function () {
			this.data.Report.addEmptyItem(this.costCenter);
			this.onReportChange();
			let iIndex = this.data.Report.Items.length - 1;
			this.data.Report.Items[iIndex].cust_datum = this.data.Report.cust_begda;
			return iIndex;
		},

		getItem: function (id) {
			return this.data.Report.Items[id];
		},

		newReport: function () {
			return this.ReportService.createReport(this.data.Report).then((result) => result.data.externalCode);
		},

		updateReport: function () {
			return this.ReportService.updateReport(this.data.Report).then((result) => {
				return result.externalCode
			});
		},

		deleteReport: function () {
			return this.ReportService.deleteReport(this.data.Report).then((result) => result.data);
		},

		createReportItemAttachment: function (sId, sFileName, sContent) {
			var oItem = this.getItem(sId);
			oItem.setAttachment(sFileName, sContent);
			oItem.hasAttachment = true;
			this.updateModel();
		},

		deleteReportItem: function (iIndex) {
			this.data.Report.deleteItem(iIndex);
			this.updateModel();
		},

		deleteReportItemAttachment: function (iIndex) {
			var oItem = this.getItem(iIndex);
			oItem.deleteAttachment();
			oItem.hasAttachment = false;
			this.updateModel();
		},

		getAttachment: function (id, sPath) {
			var oItem = this.getItem(id);
			if (typeof (oItem.Attachment) === "object") {
				return oItem.Attachment;
			}

			return this.ReportService.getAttachment(sPath).then((result) => {
				oItem.Attachment = new Attachment(result.data);
				this.updateModel();
				return oItem.Attachment;
			});
		}
	});
	return ReportState;
});
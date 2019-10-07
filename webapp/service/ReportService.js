sap.ui.define([
	"./CoreService",
	"sap/ui/model/Sorter"
], function (CoreService, Sorter) {
	"use strict";

	var ReportService = CoreService.extend("hrst.TravelExpenses.service.ReportService", {
		constructor: function (model) {
			CoreService.call(this, model);
		},
		getReport: function (id) {
			var sObjectPath = this.model.createKey("/cust_travel_expenses", {
				externalCode: id
			});
			var mParameters = {
				urlParameters: {
					$expand: "cust_adtNav, cust_toExpenseItems/cust_attachmentNav, cust_toExpenseItems/cust_typeNav"
				}
			};
			return this.odata(sObjectPath).get(mParameters);
		},

		getReports: function () {
			var mParameters = {
				urlParameters: {
					$expand: "cust_typeNav"
				}
			};
			return this.odata("/cust_travel_expenses").get(mParameters);
		},

		getReportStatus: function (id) {
			var sObjectPath = this.model.createKey("/cust_travel_expenses", {
				externalCode: id
			});
			sObjectPath = sObjectPath + "/wfRequestNav"
			return this.odata(sObjectPath).get();
		},

		createReport: function (oReport) {
			return this._createAttachments(this, oReport.Items).then((aItems) => {
				oReport.Items = aItems;
				var oData = oReport.getJSON();
				return this.odata("/cust_travel_expenses").post(oData);
			});

		},

		deleteReport: function (oReport) {
			var oData = oReport.getJSON();
			var sUrl = this.model.createKey("/cust_travel_expenses", {
				externalCode: oData.externalCode
			});
			return this.odata(sUrl).delete();
		},

		updateReport: function (oReport) {

			var maintainItems = async function (oContext, oReport) {

				debugger;
				jQuery.each(oReport.Items, (key, value) => {
					try {
						if (value.cust_type === "ADT") {
							oReport.Items.splice(key, 1);
						}
					} catch (e) {
						// nothing to do
					}
				});

				var oReport = await oContext._createAttachments(oContext, oReport.Items).then((aItems) => {
					oReport.Items = aItems;
					return oReport;
				});

				oReport = await oContext._createItems(oContext, oReport.Items).then((aItems) => {
					oReport.Items = oContext._moveCorresponding(aItems, oReport.Items);
					return oReport;
				});

				oReport = await oContext._deleteItems(oContext, oReport.getDeletedItems()).then((aItems) => {
					return oReport;
				});

				oContext._updateItems(oContext, oReport.Items).then((aItems) => {
					oReport.Items = oContext._moveCorresponding(aItems, oReport.Items);
					return oReport;
				});

				var oData = oReport.getJSON();
				delete oData.cust_toExpenseItems;

				var sUrl = oContext.model.createKey("/cust_travel_expenses", {
					externalCode: oData.externalCode
				});

				oContext.odata(sUrl).put(oData);
				return oData;

			};

			return maintainItems(this, oReport);

		},

		_moveCorresponding: function (objA, objB) {
			for (const key of Object.keys(objA)) {
				if (key in objB) {
					objB[key] = objA[key];
				}
			}
			return objB;
		},

		_createAttachment: async function (oAttachment) {
			return await this.odata("/Attachment").post(oAttachment);
		},

		_createItem: async function (oItem) {
			return await this.odata("/cust_travel_expenses_item").post(oItem);
		},

		_updateItem: async function (oItem) {
			var sUrl = this.model.createKey("/cust_travel_expenses_item", {
				externalCode: oItem.externalCode,
				cust_travel_expenses_externalCode: oItem.cust_travel_expenses_externalCode
			});

			try {
				await this.odata(sUrl).put(oItem);
			} catch (oError) {
				// do nothing
			}
			return oItem;
		},

		_deleteItem: async function (oItem) {
			var sUrl = this.model.createKey("/cust_travel_expenses_item", {
				externalCode: oItem.externalCode,
				cust_travel_expenses_externalCode: oItem.cust_travel_expenses_externalCode
			});
			return await this.odata(sUrl).delete();
		},

		getAttachment: function (sObjectPath) {
			return this.odata(sObjectPath).get();
		},

		getTypes: async function () {

			var oParameters = {
				urlParameters: {
					filter: "PickListV2_id eq cust_travel_report"
				}
			};

			return await this.odata("/PickListValueV2").get(oParameters);
		},

		_createAttachments: async function (oContext, aItems) {
			for (var i = 0; i < aItems.length; i++) {
				var oItem = aItems[i];
				if (oItem.cust_attachmentNav) {

					if (oItem.cust_attachmentNav.attachmentId) {

						// SuccessFactors accepts only the metadata
						for (const key of Object.keys(oItem.cust_attachmentNav)) {
							if (key !== "__metadata") {
								delete oItem.cust_attachmentNav[key];
							}
						}

					} else {
						await oContext._createAttachment(oItem.cust_attachmentNav).then((result) => {
							oItem.cust_attachmentNav = {};
							oItem.cust_attachmentNav.__metadata = result.data.__metadata;
							aItems[i] = oItem;
						});
					}
				}
			}
			return aItems;
		},

		_createItems: async function (oContext, aItems) {
			for (var i = 0; i < aItems.length; i++) {
				var oItem = aItems[i];
				var oData = oItem.getJSON();
				if (!oData.externalCode) {
					await oContext._createItem(oData).then((result) => {
						aItems[i] = oContext._moveCorresponding(result.data, aItems[i]);
					});
				}
			}
			return aItems;
		},

		_updateItems: async function (oContext, aItems) {
			for (var i = 0; i < aItems.length; i++) {
				var oItem = aItems[i];
				var oData = oItem.getJSON();
				if (oData.externalCode) {
					await oContext._updateItem(oData).then((result) => {
						if (result.data) {
							aItems[i] = oContext._moveCorresponding(result.data, aItems[i]);
						}
					});
				}
			}
			return aItems;
		},

		_deleteItems: async function (oContext, aItems) {
			for (var i = 0; i < aItems.length; i++) {
				var oItem = aItems[i];
				await oContext._deleteItem(oItem).then((result) => {
					return result;
				});
			}
			return aItems;
		}

	});
	return ReportService;
});
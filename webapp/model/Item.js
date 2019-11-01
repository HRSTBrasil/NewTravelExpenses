sap.ui.define([
	"./BaseObject",
	"./Attachment"
], function (BaseObject, Attachment) {
	"use strict";
	return BaseObject.extend("hrst.TravelExpenses.model.Item", {
		constructor: function (data) {
			BaseObject.call(this, data);
			this.cust_datum = "";
			this.externalName = "";
			this.DeletedAttachment = [];
			this.hasAttachment = false;
			this.minDate = "";
			this.maxDate = "";

			if (data) {
				this.cust_datum = data.cust_datum;
				this.externalName = data.externalName;
				this.cust_km = data.cust_km;
				this.cust_pepElement = data.cust_pepElement;
				this.cust_costCenter = data.cust_costCenter;
				if (data.cust_typeNav) {
					if (data.cust_typeNav.results) {
						this.cust_typeNav = data.cust_typeNav.results[0];
					} else {
						this.cust_typeNav = data.cust_typeNav;
					}
				}

				if (data.cust_attachmentNav) {
					this.cust_attachmentNav = data.cust_attachmentNav;
					this.hasAttachment = true;
				}

				if (this.cust_costCenter) {
					this.cust_pepElement = null;
				} else {
					this.cust_costCenter = null;
				}

			}

			this.Editable = true;
			this.Deletable = false;
		},

		setAttachment: function (sFileName, sContent) {
			this.cust_attachmentNav = {
				userId: "SAP_SFEC",
				fileName: sFileName,
				module: "GENERIC_OBJECT",
				fileContent: sContent
			};
		},

		deleteAttachment: function () {
			delete this.cust_attachmentNav;
		},

		getDeletedAttachment: function () {
			return this.DeletedAttachment.filter((oAttachment) => oAttachment.isNotEmpty()).map((oAttachment) => oAttachment.getJSON());
		},

		ItemNameChanged: function (oEvent) {
			this.changeEditable();
		},
		Changed: function (oEvent) {
			this.changeEditable();
		},
		changeEditable: function () {
			this.Editable = !(this.externalCode && this.cust_value);
			this.Deletable = !!(this.externalCode || this.cust_value);
		},
		isEmpty: function () {
			return this.externalCode === "";
		},
		isNotEmpty: function () {
			return (this.externalCode !== "" && this.cust_type !== "ADT");
		},
		getJSON: function () {
			var oData = {
				externalName: this.externalName || "",
				cust_datum: this.cust_datum || "",
				cust_value: this.cust_value || 0.00,
				cust_type: this.cust_type || "",
				cust_km: this.cust_km,
				cust_pepElement: this.cust_pepElement,
				cust_costCenter: this.cust_costCenter
			};

			if (this.externalCode) {
				oData.externalCode = this.externalCode;
			}
			if (this.cust_travel_expenses_externalCode) {
				oData.cust_travel_expenses_externalCode = this.cust_travel_expenses_externalCode;
			}
			if (this.cust_attachmentNav) {
				oData.cust_attachmentNav = this.cust_attachmentNav;
			}

			return oData;
		},

		// getAttachment: function () {
		// 	if (this.Attachment) {
		// 		return this.Attachment.getJSON();
		// 	}
		// 	return undefined;
		// }

	});
});
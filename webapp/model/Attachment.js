sap.ui.define([
	"./BaseObject",
], function (BaseObject) {
	"use strict";
	return BaseObject.extend("hrst.TravelExpenses.model.Attachment", {
		constructor: function (data) {
			BaseObject.call(this, data);

			this.Editable = true;
			this.Deletable = false;
		},

		getJSON: function () {
			if (this.__deferred) {
				return this;
			}
			var oData = {
				userId: this.userId || "SAP_SFEC",
				fileName: this.fileName || "",
				module: this.module || "GENERIC_OBJECT",
				fileContent: this.fileContent || ""
			};
			return oData;
		}
	});
});
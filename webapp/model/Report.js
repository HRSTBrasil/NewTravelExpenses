sap.ui.define([
	"./BaseObject",
	"./Item"
], function (BaseObject, Item) {
	"use strict";
	return BaseObject.extend("hrst.TravelExpenses.model.Report", {
		constructor: function (data, parameters) {
			BaseObject.call(this, data);

			this.enumStatus = {
				SENT: "S",
				DRAFT: "P"
			};

			this.Editable = true;
			this.Deletable = false;
			this.Items = [];
			this.DeletedItems = [];
			this.cust_begda = "";
			this.cust_endda = "";
			this.status = null;
			this.cust_currency = "BRL";
			if (parameters) {
				this.cust_user = parameters.user.name || "";
			}

			if (data) {
				this.setItems(data.cust_toExpenseItems.results);
				this.cust_begda = data.cust_begda;
				this.cust_endda = data.cust_endda;
				this.wfRequestNav = data.wfRequestNav;
				this.cust_pepElement = data.cust_pepElement;
				this.cust_costCenter = data.cust_costCenter;
				this.cust_adtNav = data.cust_adtNav;

				if (this.externalCode !== "") {
					this.Deletable = true;
				}

				if (this.cust_costCenter) {
					this.cust_pepElement = null;
				} else {
					this.cust_costCenter = null;
				}

				if (this.cust_status === this.enumStatus.SENT) {
					this.Editable = false;
					this.Deletable = false;
				}

			}

			Object.defineProperty(this, "Total", {
				get: () => {
					return (this.getItems().reduce((iTotal, oItem) => {
						return iTotal + Number(oItem.cust_value);
					}, 0))
				}
			});

		},
		ItemsChanged: function (oEvent) {
			if (oEvent) {
				if (!this.Items.some((oItem) => oItem.isEmpty())) {
					this.addEmptyItem();
				}
			}
		},

		propagateChangesToItems: function (oEvent) {
			jQuery.each(this.Items, (sKey, oItem) => {
				try {
					this.Items[sKey].minDate = new Date(this.cust_begda.replace(/\//g, "-"));
					this.Items[sKey].maxDate = new Date(this.cust_endda.replace(/\//g, "-"));
				} catch (e) {
					// nothing to do here
				}
				this.Items[sKey].cust_currency = this.cust_currency;

			});

		},

		deleteItem: function (iIndex) {
			var oItem = this.Items[iIndex];
			if (oItem.externalCode) {
				this.DeletedItems.push(oItem);
			}

			this.Items.splice(iIndex, 1);
		},
		addEmptyItem: function (sCostCenter) {
			var oItem = new Item({
				externalName: "",
				cust_value: 0.00,
				cust_currency: this.cust_currency,
				hasAttachment: false,
				cust_pepElement: null,
				cust_costCenter: sCostCenter
			});

			oItem.cust_datum = new Date();
			oItem.minDate = new Date(-8640000000000000);
			oItem.maxDate = new Date(8640000000000000);

			if (this.externalCode) {
				oItem.cust_travel_expenses_externalCode = this.externalCode;
			}
			this.Items.push(oItem);
		},
		setItems: function (aItems) {
			this.Items = aItems.map((oItem) => {
				const oNItem = new Item(oItem);
				oNItem.minDate = this.cust_begda;
				oNItem.maxDate = this.cust_endda;
				return oNItem;
			});
		},

		getItems: function () {
			return this.Items;
		},

		getItemsJSON: function () {
			return this.Items.filter((oItem) => oItem.isNotEmpty()).map((oItem) => oItem.getJSON());
		},

		getTotal: function () {
			return this.getItems().reduce((dTotal, oItem) => {
				if (oItem.cust_type === 'ADT') {
					return dTotal;
				}
				return dTotal + Number(oItem.cust_value);
			}, 0);
		},
		getDeletedItems: function () {
			return this.DeletedItems.filter((oItem) => oItem.isNotEmpty()).map((oItem) => oItem.getJSON());
		},

		getJSON: function () {
			var oData = {
				externalName: this.externalName || "",
				cust_currency: this.cust_currency || "BRL",
				cust_comment: this.cust_comment || "",
				cust_status: this.cust_status || "P",
				cust_type: this.cust_type || "",
				cust_begda: this.cust_begda || "",
				cust_endda: this.cust_endda || "",
				cust_toExpenseItems: this.getItemsJSON(),
				cust_valor_total: this.getTotal(),
				cust_pepElement: this.cust_pepElement,
				cust_costCenter: this.cust_costCenter,
				cust_user: this.cust_user,
				cust_adt: this.cust_adt || null
			};

			if (this.externalCode) {
				oData.externalCode = this.externalCode;
			}

			return oData;
		}
	});
});
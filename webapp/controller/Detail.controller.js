sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"../utilities/utilities",
	'sap/m/MessageBox',
	"sap/m/library",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, formatter, utilities, MessageBox, mobileLibrary, MessageToast) {
	"use strict";

	// shortcut for sap.m.URLHelper
	var URLHelper = mobileLibrary.URLHelper;

	return BaseController.extend("hrst.TravelExpenses.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {

			this.textsBundle = this.getResourceBundle();
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				editable: false,
				lineItemListTitle: this.textsBundle.getText("detailLineItemTableHeading")
			});

			this.ReportState = this.getOwnerComponent().getState(this.getOwnerComponent().REPORT);
			this.setModel(this.ReportState.getModel(), "rep");

			var oParameters = {};
			this.getOwnerComponent().getModel().read("/cust_TravelExpensesParameters", {
				success: (oResult) => {
					jQuery.each(oResult.results, function (i, value) {

						jQuery.each(value, function (key, v) {
							if (key.indexOf('Value') > 0 && v) {
								oParameters[value.externalCode] = v;
							}
						});
					});

					this.setModel(new JSONModel(oParameters), "param");
				}
			});

			this.setModel(oViewModel, "detailView");
			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

		},

		onUserValueHelp: function (oEvent) {

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onSend: function (oEvent) {

			if (this.ReportState.data.Report.cust_total <= 0) {
				MessageBox("Valor total inválido. Verifique e tente novamente.");
				return;
			}

			this.ReportState.data.Report.cust_status = this.ReportState.data.Report.enumStatus.SENT;
			this.onSave(oEvent);
		},

		onReportChange: function (oEvent) {

			const sFieldId = this._getRelativeId(oEvent.getSource().getId());
			switch (sFieldId) {
			case "cust_adt":
				const sKey = this.getModel().createKey("cust_travel_adt", {
					externalCode: oEvent.getSource().getSelectedKey()
				});
				const oAdt = this.getModel().oData[sKey];
				this.ReportState.setItemFromAdt(oAdt);
				break;
			case "cust_begda":

				this.byId("cust_endda").setMinDate(oEvent.getSource().getDateValue());
				break;
			case "cust_endda":

				this.byId("cust_begda").setMaxDate(oEvent.getSource().getDateValue());
				break;
			}
			this.ReportState.onReportChange();
		},

		/**
		 * Event handler when the Save button has been clicked
		 * @public
		 */
		onSave: function (oEvent) {

			var that = this;
			var oView = this.getView();
			var aInputs = [{
				type: "Input",
				oInput: oView.byId("externalName")
			}, {
				type: "Input",
				oInput: oView.byId("cust_begda")
			}, {
				type: "Input",
				oInput: oView.byId("cust_endda")
			}, {
				type: "Select",
				oInput: oView.byId("cust_type")
			}];

			var bValidationError = false;

			jQuery.each(aInputs, function (i, oInput) {
				bValidationError = that._validateInput(oInput) || bValidationError;
			});

			if (!bValidationError) {
				if (!this.ReportState.data.Report.externalCode) {
					this.ReportState.newReport().then((externalCode) => {
						this.getRouter().navTo("object", {
							externalCode: externalCode
						}, true);
					});
				} else {
					this.ReportState.updateReport().then((externalCode) => {
						MessageToast.show("Atualizado com sucesso");

						// this.getRouter().navTo("object", {
						// 	externalCode: externalCode
						// }, true);

						that.getRouter().navTo("master");

					})
				}
			} else {
				MessageBox.alert(this.textsBundle.getText("validationError"));
			}

		},

		onEdit: function (oEvent) {

			var bEdit = this.getModel("detailView").getProperty("/editable");
			var that = this;
			if (bEdit) {
				this._closeDetail(true);
			} else {
				this._toggleEdit(bEdit);
			}

		},

		onDelete: function (oEvent) {

			const that = this;
			MessageBox.confirm(this.textsBundle.getText("messageDelete"), {
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						if (that.ReportState.deleteReport()) {
							that._closeDetail(false);
						}
					}
				}
			});

		},

		onCreateItem: function (oEvent) {
			const iIndex = this.ReportState.createReportItem();
			const sPath = `/${ this.getOwnerComponent().REPORT }/${ this.getOwnerComponent().ITEMS }/${ iIndex }`;
			this._openItemDialog(sPath);
		},

		/**
		 * Event handler when the Delete button of the items list has been clicked
		 * @public
		 */
		onDeleteItem: function (oEvent) {
			var sPath = oEvent.getSource().getParent().getBindingContextPath();
			this.ReportState.deleteReportItem(this._getIndexFromPath(sPath));
		},

		/**
		 * Event handler when the item line has been clicked
		 * @public
		 */
		onItemPress: function (oEvent) {
			this._openItemDialog(oEvent.getSource().getBindingContextPath());
		},

		/**
		 * Event handler when the Ok button of the item edition has been clicked
		 * @public
		 */
		onItemClose: function (oEvent) {

			var sPath = oEvent.getSource().getBindingContext("rep").sPath;
			var iIndex = this._getIndexFromPath(sPath);
			var oItem = this.ReportState.getItem(iIndex);
			var iErrorCount = 0;

			if (!this.byId("rbCostCenter").getSelected() && !this.byId("rbPepElement").getSelected()) {
				this.byId("rbCostCenter").setValueState("Error");
				this.byId("rbPepElement").setValueState("Error");
				iErrorCount += 1;
			}

			if (oItem.cust_pepElement === "") {
				this.byId("cust_pepElement").setValueState("Error");
				iErrorCount += 1;
			} else {
				this.byId("cust_pepElement").setValueState("None");
			}
			if (oItem.cust_costCenter === "") {
				this.byId("cust_costCenter").setValueState("Error");
				iErrorCount += 1;
			} else {
				this.byId("cust_costCenter").setValueState("None");
			}
			if (oItem.cust_value <= 0) {
				this.byId("dialogCust_value").setValueState("Error");
				iErrorCount += 1;
			} else {
				this.byId("dialogCust_value").setValueState("None");
			}
			if (!oItem.cust_datum) {
				this.byId("dialogCust_datum").setValueState("Error");
				iErrorCount += 1;
			} else {
				this.byId("dialogCust_datum").setValueState("None");
			}
			if (!oItem.cust_type) {
				this.byId("dialogCust_type").setValueState("Error");
				iErrorCount += 1;
			} else {
				this.byId("dialogCust_type").setValueState("None");
			}

			if (iErrorCount === 0) {
				this._closeItemDialog();
			}
		},

		onDownloadPress: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext("rep").sPath;
			var iIndex = sPath.lastIndexOf("/") + 1;

			var oItem = this.ReportState.getItem(sPath.substr(iIndex));
			var oAttachment = oItem.cust_attachmentNav;

			var oBlob = utilities.base64toBlob(oAttachment.fileContent, "octet/stream");

			var a = window.document.createElement("a");
			a.href = window.URL.createObjectURL(oBlob);
			a.download = oAttachment.fileName;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			return 0;
		},

		onOrgOptionChange: function (oEvent) {
			let sId = oEvent.getSource().getId();
			const oItemDialog = this.byId("itemDialog");
			sId = sId.substr(sId.lastIndexOf('--') + 2);

			const sPath = oItemDialog.getBindingContext("rep").getPath();
			const oReportModel = this.getModel("rep");

			if (sId == "rbCostCenter") {
				oReportModel.setProperty(sPath + "/cust_pepElement", null);
				oReportModel.setProperty(sPath + "/cust_costCenter", "");
			} else {
				oReportModel.setProperty(sPath + "/cust_costCenter", null);
				oReportModel.setProperty(sPath + "/cust_pepElement", "");
			}
		},

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onSendEmailPress: function () {
			var oViewModel = this.getModel("detailView");

			URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function (oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		onAttachmentDeleted: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext("rep").sPath;
			var iIndex = this._getIndexFromPath(sPath);
			this.ReportState.deleteReportItemAttachment(iIndex);
		},

		onDialogCustTypeChange: function (oEvent) {
			var iIndex = this._getIndexFromPath(oEvent.getSource().getBindingContext("rep").getPath());
			var oItem = this.ReportState.getItem(iIndex);

			var sPath = this.getModel().createKey("PickListValueV2", {
				PickListV2_effectiveStartDate: new Date("1900-01-01T00:00:00"),
				PickListV2_id: "cust_travel_expense_type",
				externalCode: oEvent.getSource().getSelectedKey()
			}).replace("03%3A06%3A28", "00:00:00");

			oItem.cust_typeNav = this.getModel().oData[sPath];

		},

		onKmChange: function (oEvent) {

			var dKmValue = this.getModel("param").getProperty("/kmValue");
			var iIndex = this._getIndexFromPath(oEvent.getSource().getBindingContext("rep").getPath());
			var oItem = this.ReportState.getItem(iIndex);
			oItem.cust_value = oItem.cust_km * dKmValue;
		},

		getAttachmentFileName: function (sExternalCode, sPath) {
			this.ReportState.getAttachment(sPath);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_validateInput: function (oInput) {

			debugger;
			var oBinding = oInput.oInput.getBinding("value");
			var sValueState = "None";
			var bValidationError = false;

			if (oInput.type === "Select") {
				if (!oInput.oInput.getSelectedItem()) {
					sValueState = "Error";
					bValidationError = true;
				}
			} else {
				if (oInput.oInput.getValue() === "") {
					sValueState = "Error";
					bValidationError = true;
				}
			}

			oInput.oInput.setValueState(sValueState);
			return bValidationError;

		},

		_openItemDialog: function (sPath) {
			var oDialog = this.byId("itemDialog");

			oDialog.bindElement({
				path: sPath,
				model: "rep"
			});

			this.byId("dialogCust_datum").setMinDate(this.byId("cust_begda").getDateValue());
			this.byId("dialogCust_datum").setMaxDate(this.byId("cust_endda").getDateValue());

			oDialog.open();
		},

		_closeItemDialog: function () {
			var oDialog = this.byId("itemDialog");
			oDialog.unbindElement();
			oDialog.close();
		},

		_getIndexFromPath: function (sPath) {
			var iIndex = sPath.lastIndexOf("/") + 1;
			return sPath.substr(iIndex);

		},

		_getRelativeId: function (sAbsolute) {
			var iIndex = sAbsolute.lastIndexOf("--") + 2;
			return sAbsolute.substr(iIndex);
		},

		_toggleEdit: function (bEdit) {
			this.getModel("detailView").setProperty("/editable", !bEdit);
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {

			var sExternalCode = oEvent.getParameter("arguments").externalCode;
			var sParameter = oEvent.getParameter("arguments").parameter;

			if (sParameter === "fullscreen") {
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			}

			var that = this;
			this.getModel().setSizeLimit(300);

			if (sExternalCode === "NEW") {
				this.ReportState.createReport({
					user: this.getOwnerComponent().currentUser
				});
				this.getModel("detailView").setProperty("/busy", false);
				this.getModel("detailView").setProperty("/editable", true);
			} else {
				this.getModel().metadataLoaded().then(() => {

					var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
						oViewModel = this.getModel("detailView");

					// Make sure busy indicator is displayed immediately when
					// detail view is displayed for the first time
					oViewModel.setProperty("/delay", 0);
					// Binding the view will set it to not busy - so the view is always busy if it is not bound
					oViewModel.setProperty("/busy", true);
					// Restore original busy indicator delay for the detail view
					oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
					oViewModel.setProperty("/editable", false);

					var sObjectPath = this.getModel().createKey("cust_travel_expenses", {
						externalCode: sExternalCode
					});

					this.ReportState.getReport(sExternalCode).then(() => {
						oViewModel.setProperty("/busy", false);
					});

					this.getOwnerComponent().oListSelector.selectAListItem("/" + sObjectPath);

					if (sObjectPath !== oViewModel.getProperty("currentPath")) {
						this.getView().bindElement({
							path: "/" + sObjectPath,
							events: {
								dataRequested: function () {
									oViewModel.setProperty("/busy", true);
								},
								dataReceived: function () {
									oViewModel.setProperty("/busy", false);
								}
							}
						});

						oViewModel.setProperty("currentPath", sObjectPath);
					}

					//this.getModel("detailView").setProperty("/busy", false);
				});
			}

			var oFileUpload = this.byId("dialogFileUploader");
			oFileUpload.handlechange = this._fileHandleChange.bind(null, oFileUpload, that);

		},

		_fileHandleChange: function (oFileUpload, oContext, oEvent) {
			var oDomRef = oFileUpload.getFocusDomRef();
			var oFile = oDomRef.files[0];
			var oReader = new FileReader();

			var sPath = oFileUpload.getBindingContext("rep").sPath;
			var iIndex = sPath.lastIndexOf("/") + 1;
			var iId = sPath.substr(iIndex);
			var oItem = oContext.ReportState.getItem(iId);

			oReader.onload = function (oItem, iId, oFile, oEvent) {
				var vContent = oEvent.currentTarget.result.replace("data:" + oFile.type + ";base64,", "");
				oContext.ReportState.createReportItemAttachment(iId, oFile.name, vContent);
			}.bind(null, oContext, iId, oFile);

			oReader.readAsDataURL(oFile);
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");
			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel().getObject(sPath),
				sExternalCode = oObject.externalCode,
				sExternalName = oObject.externalName,
				oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sExternalCode]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sExternalName, sExternalCode, location.href]));
		},

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView"),
				oLineItemTable = this.byId("lineItemsList"),
				iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {

			var bShowConfirm = this.getModel("detailView").getProperty("/editable");
			this._closeDetail(bShowConfirm);
		},

		_closeDetail: function (bShowConfirm) {
			var that = this;
			var __close = function () {
				that.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
				// No item should be selected on master after detail page is closed
				that.getOwnerComponent().oListSelector.clearMasterListSelection();
				that.getRouter().navTo("master");
			};

			if (bShowConfirm) {
				MessageBox.confirm(this.textsBundle.getText("messageCancel"), {
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.OK) {
							__close();
						}
					}
				});
			} else {
				__close();
			}

		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		}
	});

});
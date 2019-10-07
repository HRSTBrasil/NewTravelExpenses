sap.ui.define([
	"sap/ui/model/odata/v2/ODataModel",
	"sap/base/util/merge"
], function (ODataModel, merge) {
	"use strict";
	var ODataNewModel = ODataModel.extend("hrst.TravelExpenses.model.ODataModel", {
		constructor: function () {
			ODataModel.apply(this, arguments);
		}
	});

	ODataNewModel.prototype._processSuccess = function (oRequest, oResponse, fnSuccess, mGetEntities, mChangeEntities, mEntityTypes, bBatch,
		aRequests) {
		var oResultData = oResponse.data,
			oImportData, bContent, sUri, sPath, aParts, oEntity,
			oEntityMetadata, mLocalGetEntities = {},
			mLocalChangeEntities = {},
			that = this;

		if (!bBatch) {
			bContent = !(oResponse.statusCode === 204 || oResponse.statusCode === '204');

			sUri = oRequest.requestUri;
			sPath = sUri.replace(this.sServiceUrl, "");
			//in batch requests all paths are relative
			if (!sPath.startsWith('/')) {
				sPath = '/' + sPath;
			}
			sPath = this._normalizePath(sPath);
			// decrease laundering
			this.decreaseLaundering(sPath, oRequest.data);
			this._decreaseDeferredRequestCount(oRequest);

			// no data available
			if (bContent && oResultData === undefined && oResponse) {

				if (oResponse.statusCode === 200 || oResponse.statusCode === '200') {
					oResultData = oResponse.data = oRequest.data;
					bContent = true;
				} else {

					// Parse error messages from the back-end
					this._parseResponse(oResponse, oRequest);

					Log.fatal(this + " - No data was retrieved by service: '" + oResponse.requestUri + "'");
					that.fireRequestCompleted({
						url: oResponse.requestUri,
						type: "GET",
						async: oResponse.async,
						info: "Accept headers:" + this.oHeaders["Accept"],
						infoObject: {
							acceptHeaders: this.oHeaders["Accept"]
						},
						success: false
					});
					return false;
				}
			}

			// broken implementations need this
			if (oResultData && oResultData.results && !Array.isArray(oResultData.results)) {
				oResultData = oResultData.results;
			}

			// adding the result data to the data object
			if (!oResponse._imported && oResultData && (Array.isArray(oResultData) || typeof oResultData == 'object')) {
				//need a deep data copy for import
				oImportData = merge({}, oResultData);
				if (oRequest.key || oRequest.created) {
					that._importData(oImportData, mLocalGetEntities, oResponse);
				} else {
					that._importData(oImportData, mLocalGetEntities, oResponse, sPath, oRequest.deepPath);
				}
				oResponse._imported = true;
			}

			oEntity = this._getEntity(oRequest.key);
			if (mLocalGetEntities && oEntity && oEntity.__metadata.created && oEntity.__metadata.created.functionImport) {
				var aResults = [];
				var oResult = oEntity["$result"];
				if (oResult && oResult.__list) {
					each(mLocalGetEntities, function (sKey) {
						aResults.push(sKey);
					});
					oResult.__list = aResults;
				} else if (oResult && oResult.__ref) {
					//there should be only 1 entity in mLocalGetEntities
					each(mLocalGetEntities, function (sKey) {
						oResult.__ref = sKey;
					});
				}
			}

			//get change entities for update/remove
			if (!bContent) {
				aParts = sPath.split("/");
				if (aParts[1]) {
					mLocalChangeEntities[aParts[1]] = oRequest;
					//cleanup of this.mChangedEntities; use only the actual response key
					var oMap = {};
					oMap[aParts[1]] = oRequest.data;
					this._updateChangedEntities(oMap);
				}
				//for delete requests delete data in model (exclude $links)
				if (oRequest.method === "DELETE" && aParts[2] !== "$links") {
					this._removeEntity(aParts[1]);
				}
			}
			//get entityType for creates
			if (bContent && oRequest.method === "POST") {
				oEntityMetadata = this.oMetadata._getEntityTypeByPath(sPath);
				if (oEntityMetadata) {
					mEntityTypes[oEntityMetadata.entityType] = true;
				}
				if (oRequest.key) { // e.g. /myEntity
					// for createEntry entities change context path to new one
					if (oRequest.created) {
						var sKey = this._getKey(oResultData); // e.g. /myEntity-4711
						// rewrite context for new path
						var oContext = this.getContext("/" + oRequest.key);
						oContext.bCreated = false;
						this._updateContext(oContext, '/' + sKey);
						oContext.setUpdated(true);
						// register function to reset updated flag call as callAfterUpdate
						this.callAfterUpdate(function () {
							oContext.setUpdated(false);
						});
						//delete created flag after successful creation
						oEntity = this._getEntity(sKey);
						if (oEntity) {
							delete oEntity.__metadata.created;
						}
					}
					// remove old entity/context for created and function imports
					this._removeEntity(oRequest.key);
				}
			}

			// Parse messages from the back-end
			this._parseResponse(oResponse, oRequest, mLocalGetEntities, mLocalChangeEntities);

			// Add the Get and Change entities from this request to the main ones (which differ in case of batch requests)
			jQuery.extend(mGetEntities, mLocalGetEntities);
			jQuery.extend(mChangeEntities, mLocalChangeEntities);

			this._updateETag(oRequest, oResponse);
		}

		if (fnSuccess) {
			fnSuccess(oResultData, oResponse);
		}

		var oEventInfo = this._createEventInfo(oRequest, oResponse, aRequests);
		if (bBatch) {
			this.fireBatchRequestCompleted(oEventInfo);
		} else {
			this.fireRequestCompleted(oEventInfo);
		}

		return true;
	};

	ODataNewModel.prototype._loadData = function (sPath, aParams, fnSuccess, fnError, bCache, fnHandleUpdate, fnCompleted) {

		// create a request object for the data request
		var oRequestHandle,
			oRequest,
			that = this;

		function _handleSuccess(oData, oResponse) {

			var oResultData = oData,
				mChangedEntities = {};

			// no data response
			if (oResponse.statusCode == 204) {
				if (fnSuccess) {
					fnSuccess(null);
				}
				if (fnCompleted) {
					fnCompleted(null);
				}
				that.fireRequestCompleted({
					url: oRequest.requestUri,
					type: "GET",
					async: oRequest.async,
					info: "Accept headers:" + that.oHeaders["Accept"],
					infoObject: {
						acceptHeaders: that.oHeaders["Accept"]
					},
					success: true
				});
				return;
			}

			// no data available
			if (!oResultData) {
				Log.fatal("The following problem occurred: No data was retrieved by service: " + oResponse.requestUri);
				that.fireRequestCompleted({
					url: oRequest.requestUri,
					type: "GET",
					async: oRequest.async,
					info: "Accept headers:" + that.oHeaders["Accept"],
					infoObject: {
						acceptHeaders: that.oHeaders["Accept"]
					},
					success: false
				});
				return false;
			}

			if (that.bUseBatch) { // process batch response
				// check if errors occurred in the batch
				var aErrorResponses = that._getBatchErrors(oData);
				if (aErrorResponses.length > 0) {
					// call handle error with the first error.
					_handleError(aErrorResponses[0]);
					return false;
				}

				if (oResultData.__batchResponses && oResultData.__batchResponses.length > 0) {
					oResultData = oResultData.__batchResponses[0].data;
				} else {
					Log.fatal("The following problem occurred: No data was retrieved by service: " + oResponse.requestUri);
				}
			}

			aResults = aResults.concat(oResultData.results);
			// check if not all requested data was loaded
			if (oResultData.__next) {
				// replace request uri with next uri to retrieve additional data
				var oURI = new URI(oResultData.__next);
				oRequest.requestUri = oURI.absoluteTo(oResponse.requestUri).toString();
				_submit(oRequest);
			} else {
				// all data is read so merge all data
				if (oResultData.results) {
					var vValue, vKey;
					for (vKey in aResults) {
						vValue = aResults[vKey];

						// Prevent never-ending loop
						if (aResults === vValue) {
							continue;
						}

						oResultData.results[vKey] = vValue;
					}
				}

				// broken implementations need this
				if (oResultData.results && !Array.isArray(oResultData.results)) {
					oResultData = oResultData.results;
				}
				// adding the result data to the data object
				that._importData(oResultData, mChangedEntities);

				// reset change key if refresh was triggered on that entry
				if (that.sChangeKey && mChangedEntities) {
					var sEntry = that.sChangeKey.substr(that.sChangeKey.lastIndexOf('/') + 1);
					if (mChangedEntities[sEntry]) {
						delete that.oRequestQueue[that.sChangeKey];
						that.sChangeKey = null;
					}
				}

				if (fnSuccess) {
					fnSuccess(oResultData);
				}
				that.checkUpdate(false, false, mChangedEntities);
				if (fnCompleted) {
					fnCompleted(oResultData);
				}
				that.fireRequestCompleted({
					url: oRequest.requestUri,
					type: "GET",
					async: oRequest.async,
					info: "Accept headers:" + that.oHeaders["Accept"],
					infoObject: {
						acceptHeaders: that.oHeaders["Accept"]
					},
					success: true
				});
			}
		}

		function _handleError(oError) {
			// If error is a 403 with XSRF token "Required" reset token and retry sending request
			if (that.bTokenHandling && oError.response) {
				var sToken = that._getHeader("x-csrf-token", oError.response.headers);
				if (!oRequest.bTokenReset && oError.response.statusCode == '403' && sToken && sToken.toLowerCase() == "required") {
					that.resetSecurityToken();
					oRequest.bTokenReset = true;
					_submit();
					return;
				}
			}

			var mParameters = that._handleError(oError);

			if (fnError) {
				fnError(oError, oRequestHandle && oRequestHandle.bAborted);
			}

			that.fireRequestCompleted({
				url: oRequest.requestUri,
				type: "GET",
				async: oRequest.async,
				info: "Accept headers:" + that.oHeaders["Accept"],
				infoObject: {
					acceptHeaders: that.oHeaders["Accept"]
				},
				success: false,
				errorobject: mParameters
			});

			// Don't fire RequestFailed for intentionally aborted requests; fire event if we have no (OData.read fails before handle creation)
			if (!oRequestHandle || !oRequestHandle.bAborted) {
				mParameters.url = oRequest.requestUri;
				that.fireRequestFailed(mParameters);
			}
		}

		/**
		 * this method is used to retrieve all desired data. It triggers additional read requests if the server paging size
		 * permits to return all the requested data. This could only happen for servers with support for OData > 2.0.
		 */
		function _submit() {
			// execute the request and use the metadata if available

			if (that.bUseBatch) {
				that.updateSecurityToken();
				// batch requests only need the path without the service URL
				// extract query of url and combine it with the path...
				var sUriQuery = URI.parse(oRequest.requestUri).query;
				//var sRequestUrl = sPath.replace(/\/$/, ""); // remove trailing slash if any
				//sRequestUrl += sUriQuery ? "?" + sUriQuery : "";
				var sRequestUrl = that._createRequestUrl(sPath, null, sUriQuery, that.bUseBatch);
				oRequest = that._createRequest(sRequestUrl, "GET", true);
				var oBatchRequest = that._createBatchRequest([oRequest], true);
				oRequestHandle = that._request(oBatchRequest, _handleSuccess, _handleError, OData.batchHandler, undefined, that.getServiceMetadata());
			} else {
				oRequestHandle = that._request(oRequest, _handleSuccess, _handleError, that.oHandler, undefined, that.getServiceMetadata());
			}

			if (fnHandleUpdate) {
				// Create a wrapper for the request handle to be able to differentiate
				// between intentionally aborted requests and failed requests
				var oWrappedHandle = {
					abort: function () {
						oRequestHandle.bAborted = true;
						oRequestHandle.abort();
					}
				};
				fnHandleUpdate(oWrappedHandle);
			}
		}

		// execute request
		var aResults = [];
		var sUrl = this._createRequestUrl(sPath, null, aParams, null, bCache || this.bCache);
		oRequest = this._createRequest(sUrl, "GET", true);
		this.fireRequestSent({
			url: oRequest.requestUri,
			type: "GET",
			async: oRequest.async,
			info: "Accept headers:" + this.oHeaders["Accept"],
			infoObject: {
				acceptHeaders: this.oHeaders["Accept"]
			}
		});
		_submit();
	};

	return ODataNewModel;
});
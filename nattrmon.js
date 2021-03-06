// Initialization
var LOGHK_HOWLONGAGOINMINUTES = 30 * 24 * 60; // How long to keep logs
var LOGAUDIT                  = true;         // Set to false to turn it off
var LOGAUDIT_TEMPLATE         = "AUDIT | User: {{request.user}} | Channel: {{name}} | Operation: {{op}} | Key: {{{key}}}";
var JAVA_ARGS                 = [ ];          // Array of java arguments
var LOGCONSOLE                = false;        // Create files or log to console
var MAXPLUGEXECUTE_TIME       = void 0;       // Max default time for plug execution
var DEBUG                     = false;
var BUFFERCHANNELS            = false;
var BUFFERBYNUMBER            = 100;
var BUFFERBYTIME              = 1000;
var WORKERS                   = __cpucores;
var COREOBJECTS               = void 0;
var COREOBJECTS_LAZYLOADING   = false;
var NEED_CH_PERSISTENCE       = true;

// -------------------------------------------------------------------

// check version
af.getVersion() >= "20170101" || (print("Version " + af.getVersion() + ". You need OpenAF version 20170101 to run.")) || exit(-1);

var NATTRMON_HOME = getOPackPath("nAttrMon") || ".";
var params = processExpr();

if (io.fileExists(NATTRMON_HOME + "/nattrmon.yaml")) {
	var pms = io.readFileYAML(NATTRMON_HOME + "/nattrmon.yaml");

	if (isUnDef(pms) || pms == null) pms = {};
	if (isDef(pms.JAVA_ARGS) && isArray(pms.JAVA_ARGS)) JAVA_ARGS = pms.JAVA_ARGS;
	if (isDef(pms.LOGAUDIT)) LOGAUDIT = pms.LOGAUDIT;
	if (isDef(pms.LOGAUDIT_TEMPLATE) && isString(pms.LOGAUDIT_TEMPLATE)) LOGAUDIT_TEMPLATE = pms.LOGAUDIT_TEMPLATE;
	if (isDef(pms.LOGHK_HOWLONGAGOINMINUTES) && isNumber(pms.LOGHK_HOWLONGAGOINMINUTES)) LOGHK_HOWLONGAGOINMINUTES = pms.LOGHK_HOWLONGAGOINMINUTES; 
	if (isDef(pms.NUMBER_WORKERS)) { __cpucores = Number(pms.NUMBER_WORKERS); WORKERS = Number(pms.NUMBER_WORKERS); }
	if (isDef(pms.LOG_ASYNC)) __logFormat.async = pms.LOG_ASYNC;
	if (isDef(pms.DEBUG)) DEBUG = pms.DEBUG;	
	if (isDef(pms.LOGCONSOLE)) LOGCONSOLE = pms.LOGCONSOLE;
	if (isDef(pms.MAXPLUGEXECUTE_TIME)) MAXPLUGEXECUTE_TIME = pms.MAXPLUGEXECUTE_TIME;
	if (isUnDef(params.withDirectory) && isDef(pms.CONFIG)) params.withDirectory = pms.CONFIG;

	if (isDef(pms.BUFFERCHANNELS)) BUFFERCHANNELS = pms.BUFFERCHANNELS;
	if (isDef(pms.BUFFERBYNUMBER)) BUFFERBYNUMBER = pms.BUFFERBYNUMBER;
	if (isDef(pms.BUFFERBYTIME))   BUFFERBYTIME = pms.BUFFERBYTIME;

	if (isDef(pms.COREOBJECTS))    COREOBJECTS = pms.COREOBJECTS;
	if (isDef(pms.COREOBJECTS_LAZYLOADING)) COREOBJECTS_LAZYLOADING = pms.COREOBJECTS_LAZYLOADING;

	print("Applying parameters:");
	print(af.toYAML(pms));
}

// Auxiliary objects
load(NATTRMON_HOME + "/lib/nattribute.js");
load(NATTRMON_HOME + "/lib/nattributevalue.js");
load(NATTRMON_HOME + "/lib/nattributes.js");
load(NATTRMON_HOME + "/lib/nmonitoredobject.js");
load(NATTRMON_HOME + "/lib/nplug.js");
load(NATTRMON_HOME + "/lib/ninput.js");
load(NATTRMON_HOME + "/lib/noutput.js");
load(NATTRMON_HOME + "/lib/nwarning.js");
load(NATTRMON_HOME + "/lib/nwarnings.js");
load(NATTRMON_HOME + "/lib/nvalidation.js");

ow.loadServer();
ow.loadObj(); 
ow.loadFormat(); 
ow.loadTemplate();
ow.template.addFormatHelpers();
ow.template.addConditionalHelpers();
loadLodash(); 

// nAttrMon template helpers -----------------------------------------------------------------
// -------------------------------------------------------------------------------------------

ow.template.addHelper("attr", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getAttributes().getAttributeByName(a);
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("cval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getCurrentValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("lval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getLastValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("warn", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getWarnings(true).getWarningByName(a);
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});

ow.template.addHelper("debug", (s) => { sprint(s); });
ow.template.addHelper("stringify", (s) => { return stringify(s); });
ow.template.addHelper("stringifyInLine", (s) => { return stringify(s, void 0, ""); });
ow.template.addHelper("toYAML", (s) => { return af.toYAML(s); });
ow.template.addHelper("env", (s) => { return java.lang.System.getenv().get(s); });
ow.template.addHelper("escape", (s) => { return s.replace(/['"]/g, "\\$1"); });

// Main object ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

const nAttrMon = function(aConfigPath, debugFlag) {
	plugin("Threads");

	this.chCurrentValues = "nattrmon::cvals";
	this.chLastValues = "nattrmon::lvals";
	this.chPS = "nattrmon::ps";

	$ch(this.chCurrentValues).create(1, "simple");
	$ch(this.chLastValues).create(1, "simple");
	$ch(this.chPS).create(1, "simple");

	// Buffer cvals
	if (BUFFERCHANNELS) {
		$ch(this.chCurrentValues).subscribe(ow.ch.utils.getBufferSubscriber(this.chCurrentValues, [ "name" ], BUFFERBYNUMBER, BUFFERBYTIME));
	}

	this.currentValues    = $ch(this.chCurrentValues);
	this.lastValues       = $ch(this.chLastValues);

	this.configPath       = (isUnDef(aConfigPath)) ? "." : aConfigPath;
	this.listOfAttributes = new nAttributes();
	this.listOfWarnings   = new nWarnings();
	this.count            = now();
	this.countCheck       = 30000; // shouldn't be very aggresive
	this.debugFlag        = (isUnDef(debugFlag)) ? false : debugFlag;

	this.plugs = {};

	this.PLUGINPUTS      = "inputs";
	this.PLUGOUTPUTS     = "outputs";
	this.PLUGVALIDATIONS = "validations";
	this.PLUGSYSTEM      = "system";

	this.threads = [];
	this.threadsSessions = {};
	this.sessionData = {};
	this.monitoredObjects = {};
	this.objPools = {};
	this.objPoolsCat = {};
	this.objPoolsAssociations = {};
	this.indexPlugThread = {};
	this.sch = new ow.server.scheduler(); // schedule plugs thread pool
	this.schList = {}; // schedule plugs list
	this.ignoreList = [];

	plugin("Threads");
	this.thread = new Threads();
	this.thread.initScheduledThreadPool(WORKERS);
	this.threads.push(this.thread);

	var nattrmon = this;

	// Start logging
	if (!LOGCONSOLE) {
		io.mkdir(aConfigPath + "/log");
		ow.ch.utils.setLogToFile({
			logFolder: aConfigPath + "/log",
			HKhowLongAgoInMinutes: LOGHK_HOWLONGAGOINMINUTES,
			numberOfEntriesToKeep: 10,
			setLogOff            : true
		});
	}

	if (LOGAUDIT) {
		ow.ch.server.setLog(function(aMap) {
			aMap = merge(aMap, { key: stringify(jsonParse(aMap.request.uri.replace(/.+({[^}]+}).*/, "$1").replace(/&quot;/g, "\'")),undefined,"").replace(/\"/g, "") });
			tlog(LOGAUDIT_TEMPLATE, aMap);
		});
	}

	if (!LOGCONSOLE) print(new Date() + " | Starting log to " + aConfigPath + "/log");

	// date checks
	this.currentValues.subscribe((new nAttributeValue()).convertDates);
	this.lastValues.subscribe((new nAttributeValue()).convertDates);
	this.listOfAttributes.getCh().subscribe((new nAttribute()).convertDates);
    this.listOfWarnings.getCh().subscribe((new nWarning()).convertDates);
   
	// persistence
	if (NEED_CH_PERSISTENCE) {
		this.listOfWarnings.getCh().storeAdd(this.getConfigPath() + "/nattrmon.warns.snapshot", [ "title" ], true);
		this.listOfAttributes.getCh().storeAdd(this.getConfigPath() + "/nattrmon.attrs.snapshot", [ "name" ], true);
		this.lastValues.storeAdd(this.getConfigPath() + "/nattrmon.lvals.snapshot", [ "name" ], true);
		this.currentValues.storeAdd(this.getConfigPath() + "/nattrmon.cvals.snapshot", [ "name" ], true);
	}
};

nAttrMon.prototype.getConfigPath = function() {
	return this.configPath;
};

// Snapshot functions
// ------------------

nAttrMon.prototype.genSnapshot = function() {
	var mainpath = this.getConfigPath();
	var snapshot = {
		currentValues: ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true),
		lastValues: ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true),
		listOfAttributes: this.listOfAttributes.getAttributes(true),
		listOfWarnings: this.listOfWarnings.getWarnings(true)
	};
	io.writeFileBytes(mainpath + "/nattrmon.snapshot", compress(snapshot));
};

// Session function
// ----------------

nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject;
};

nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey];
};

nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUnDef(this.getSessionData(aKey))) {
		return false;
	} else {
		return true;
	}
};

// Debug functions
// ---------------
nAttrMon.prototype.setDebug = function(aDebugFlag) {
	this.debugFlag = aDebugFlag;
};

// Monitored objects
// -----------------

nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject);
	return this.getMonitoredObject(aKey);
};

nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject();
};

nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUnDef(this.monitoredObjects[aKey])) {
		return false;
	} else {
		return true;
	}
};

nAttrMon.prototype.monitoredObjectsTest = function() {
	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].test();
	}
};

nAttrMon.prototype.declareMonitoredObjectDirty = function(aKey) {
	this.monitoredObjects[aKey].setDirty();
	this.monitoredObjects[aKey].test();
};

// Object pools
// ------------

/**
 * <odoc>
 * <key>nattrmon.isObjectPool(aKey) : boolean</key>
 * Determines if there is an ObjectPool for the provided aKey. Returns true or false.
 * </odoc>
 */
nAttrMon.prototype.isObjectPool = function(aKey) {
	if (isDef(this.objPools[aKey]))
		return true;
	else
		return false;
};

/**
 * <odoc>
 * <key>nattrmon.addObjectPool(aKey, aOWObjPool, aCat, aLifeCycle)</key>
 * Given a aOWObjPool (created, but not started, from ow.obj.pool) starts it and adds it to nattrmon
 * with the provided aKey. Later objects can be requested and returned using nattrmon.leaseObject and
 * nattrmon.returnObject. Optionally you can provide a aCat category and/or aLifeCycle map (limit, fn and last).
 * </odoc>
 */
nAttrMon.prototype.addObjectPool = function(aKey, aOWObjPool, aCat, aLifeCycle) {
	this.objPools[aKey] = aOWObjPool.start();
	this.objPoolsCat[aKey] = aCat;
	this.objPoolsAssociations[aKey] = {};
	return this;
};

/**
 * <odoc>
 * <key>nattrmon.getObjectPool(aKey) : Object</key>
 * Returns the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.getObjectPool = function(aKey) {
	return this.objPools[aKey];
};

/**
 * <odoc>
 * <key>nattrmon.delObjectPool(aKey) : nattrmon</key>
 * Deletes the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.delObjectPool = function(aKey) {
    this.objPools[aKey].stop();
	//deleteFromArray(this.objPools, this.objPools.indexOf(aKey));
	delete this.objPools[aKey];
	delete this.objPoolsCat[aKey];
	delete this.objPoolsAssociations[aKey];

	return this;
};

/**
 * <odoc>
 * <key>nattrmon.getObjectPoolKeys(aKey, aCategory) : Array</key>
 * Retrieves the current list of object pool keys. Optionally you can filter by a specific aCategory provided
 * on addObjectPool.
 * </odoc>
 */
nAttrMon.prototype.getObjectPoolKeys = function(aCat) {
	var res = [];
	if (isUnDef(aCat))
		return Object.keys(this.objPools);
	else {
		var ori = Object.keys(this.objPools);
		for(var i in ori) {
			if (this.objPoolsCat[ori[i]] == aCat) {
				res.push(ori[i]);
			}
		}
	}

	return res;
};

/**
 * <odoc>
 * <key>nattrmon.leaseObject(aKey) : Object</key>
 * Ask the object pool associated with aKey for an object instance to be used.
 * </odoc>
 */
nAttrMon.prototype.leaseObject = function(aKey) {
	return this.objPools[aKey].checkOut();
};

/**
 * <odoc>
 * <key>nattrmon.returnObject(aKey, anObj, aStatus)</key>
 * Returns an object that was previsouly leased using nattrmon.leaseObject for the object pool associated with aKey
 * providing aStatus (false = obj should be thrown away).
 * </odoc>
 */
nAttrMon.prototype.returnObject = function(aKey, anObj, aStatus) {
	return this.objPools[aKey].checkIn(anObj, aStatus);
};

/**
 * <odoc>
 * <key>nattrmon.useObject(aKey, aFunction)</key>
 * Given aFunction will pass it, as an argument, an object instance to be used from the object pool associated with aKey.
 * If aFunction throws anException or returns false the provided object instance will be thrown away.
 * </odoc>
 */
nAttrMon.prototype.useObject = function(aKey, aFunction) {
	// Temporary until dependency OpenAF >= 20181210
	if (isUnDef(this.objPools[aKey])) {
		logWarn("Object pool '" + aKey + "' doesn't exist.");
		return false;
	} else {
		return this.objPools[aKey].use(function(v) {
			var res = aFunction(v);
			if (isDef(res)) return res; else return true;
		});
	}
};

/**
 * <odoc>
 * <key>nattrmon.associateObjectPool(aParentKey, aChildKey, aPathAssociation)</key>
 * Associates aChildKey to aParentKey for aPathAssociation. For example:\
 * \
 * nattrmon.associateObjectPool("FMS", "FMSAPP", "db.app");\
 * \
 * This will associate the db object pool FMSAPP to the af object pool FMS. Specifically for "db.app".\
 * \
 * </odoc>
 */
nAttrMon.prototype.associateObjectPool = function(aParentKey, aChildKey, aPath) {
	this.objPoolsAssociations[aParentKey][aPath] = aChildKey;
};

/**
 * <odoc>
 * <key>nattrmon.getAssociatedObjectPool(aParentKey, aPath) : String</key>
 * Returns the associated object pool to aParentKey given aPath. Example:\
 * \
 * var dbPoolName = nattrmon.getAssociatedObjectPool("FMS", "db.app");\
 * \
 * </odoc>
 */
nAttrMon.prototype.getAssociatedObjectPool = function(aParentKey, aPath) {
	return this.objPoolsAssociations[aParentKey][aPath];
};

/**
 * <odoc>
 * <key>nattrmon.newSSHObjectPool(aSSHURL) : ObjectPool</key>
 * Creates a new ow.obj.pool.SSH based on the provided aSSHURL in the form:
 *  ssh://user:password@host:port/pathToIdentificationKey
 * </odoc>
 */
nAttrMon.prototype.newSSHObjectPool = function(aURL) {
	var uri = new java.net.URI(aURL);

	if (uri.getScheme().toLowerCase() == "ssh") {
		var port = uri.getPort();
		var [user, pass] = String(uri.getUserInfo()).split(/:/);
		var path = uri.getPath();
		return ow.obj.pool.SSH(String(uri.getHost()), (Number(port) > 0) ? port : 22, user, pass, (String(path).length > 0) ? String(path) : void 0, true);
	}
};

// System functions
// ----------------

nAttrMon.prototype.debug = function(aMessage) {
	if(this.debugFlag) {
		ansiStart();
		log(ansiColor("BG_YELLOW,BLACK", "DEBUG | " + aMessage));
		ansiStop();
	}
};

nAttrMon.prototype.start = function() {
	this.debug("nAttrMon monitor plug");

	this.addPlug(this.PLUGSYSTEM,
		         {"name": "system monitor", "timeInterval": this.countCheck, "waitForFinish": false, "onlyOnEvent": false}, 
		         new nValidation(function() {
		         	nattrmon.count = now();
		         	//nattrmon.genSnapshot();
		         }),
		         {});
	this.execPlugs(this.PLUGSYSTEM);
	this.debug("nAttrMon start load plugs");
	this.loadPlugs();
	this.debug("nAttrMon exec input plugs");
	this.execPlugs(this.PLUGINPUTS);
	this.debug("nAttrMon exec output plugs");
	this.execPlugs(this.PLUGOUTPUTS);
	this.debug("nAttrMon exec validation plugs");
	this.execPlugs(this.PLUGVALIDATIONS);

	this.debug("nAttrMon restoring snapshot");
}

nAttrMon.prototype.stop = function() {
	this.debug("nAttrMon stoping.");
	for(var i in this.threads) {
		this.threads[i].stop(true);
	}

	for(var i in this.threads) {
		this.threads[i].waitForThreads(1000);
	}

	//this.genSnapshot();
	this.stopObjects();
}

nAttrMon.prototype.stopObjects = function() {
	for(var i in this.objPools) {
		this.objPools[i].stop();
		delete this.objPools[i];
	}
	this.objPools = {};

	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].tryToClose(o);
		delete this.monitoredObjects[o];
	}
	this.monitoredObjects = {};

	for(var itype in this.plugs) {
		for(var iplug in this.plugs[itype]) {
			try {
				this.plugs[itype][iplug].close();
			} catch(e) {
			}
		}
	}
}

nAttrMon.prototype.restart = function() {
	this.debug("nAttrMon restarting");
	this.stop();
	restartOpenAF(void 0, JAVA_ARGS);
};

// Attribute management
// --------------------

nAttrMon.prototype.getAttributes = function(justData) {
	if (justData)
		return this.listOfAttributes.getAttributes(justData);
	else
		return this.listOfAttributes;
}

nAttrMon.prototype.setAttribute = function(aName, aDescription, aType) {
	this.listOfAttributes.setAttribute(new nAttribute(aName, aDescription, aType));
}

nAttrMon.prototype.setAttributes = function(aStruct) {
	for(var attr in aStruct) {
		this.listOfAttributes.setAttribute(new nAttribute(attr, aStruct[attr]));
	}
}

// Warning management
// ------------------

nAttrMon.prototype.setWarnings = function(anArrayofWarnings) {
	for(var i in anArrayofWarnings) {
		this.listOfWarnings.setWarning(anArrayofWarnings[i]);
	}
}

nAttrMon.prototype.getWarnings = function(full) {
	if (full) {
           return this.listOfWarnings;
        } else {
           return this.listOfWarnings.getWarnings();
        }
}

nAttrMon.prototype.setNotified = function(aTitle, aId, aValue) {
	if (isUnDef(aValue)) aValue = true;
	if (isUnDef(aId)) throw "Please provide a setNotified id";

	var w = nattrmon.getWarnings(true).getWarningByName(aTitle);
	if (isUnDef(w)) return false;

	if (isUnDef(w.notified)) w.notified = {};
	w.notified[aId] = aValue;
	nattrmon.getWarnings(true).setWarningByName(aTitle, w);
	return true; 
};

nAttrMon.prototype.isNotified = function(aTitle, aId) {
	if (isUnDef(aId)) throw "Please provide a setNotified id";

	var w = nattrmon.getWarnings(true).getWarningByName(aTitle);
	if (isUnDef(w) || isUnDef(w.notified)) return false;
	return w.notified[aId];
};

// Attribute values management
// ---------------------------

nAttrMon.prototype.getCurrentValues = function(full) {
	if (full) {
		return this.currentValues;
	} else {
		return ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true);
	}
}

nAttrMon.prototype.getLastValues = function(full) {
	if (full) {
		return this.lastValues;
	} else {
		return ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true);
	}
}

nAttrMon.prototype.getHistoryValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var attrHist = this.getSessionData("attribute.history");
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.");
		return {};
	} else {
		try {
			return attrHist.getValuesByTime(anAttributeName, howManySecondsAgo);
		} catch(e) {
			this.debug("Error getting historical values by time: " + e);
			return {};
		}
	}
}

nAttrMon.prototype.getHistoryValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var attrHist = this.getSessionData("attribute.history");
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.");
		return {};
	} else {
		try {
			return attrHist.getValuesByEvents(anAttributeName, howManyEventsAgo);
		} catch(e) {
			this.debug("Error getting historical values by events: " + e);
			return {};
		}
 	}
};

nAttrMon.prototype.posAttrProcessing = function (et, values) {
	var sortKeys;
	var toArray = _$(et.toArray).isMap("toArray needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	var stamp = _$(et.aStamp).isMap("stamp needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	sortKeys = _$(et.sortKeys).isMap("sort needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	if (isDef(et.aSort) && isMap(et.aSort)) sortKeys = et.aSort;

	// Utilitary functions
	var sorting = (v) => {
		if (isDef(sortKeys)) {
			for(var key in v) {
				if (isDef(sortKeys[key]) && isArray(sortKeys[key]) && isArray(v[key])) {
					var temp = $from(v[key]);
					for(var iii in sortKeys[key]) {
						temp = temp.sort(sortKeys[key][iii]);
					}
					v[key].val = temp.select();
				}
			}
		} 
		return v;
	};

	// Stamp
	if (isDef(stamp)) {
		for(var key in values) {
			values[key] = merge(values[key], stamp);
		}
	}

	// Handle to array
	if (isDef(toArray) &&
		isDef(toArray.attrName)) {
		var aFutureValues = {};
		toArray.key = _$(toArray.key)
					.isString("toArray key needs to be a string. " + stringify(toArray,void 0,""))
					.default("key");
		toArray.attrName = _$(toArray.attrName)
						.isString("toArray attrName needs to be a string. " + stringify(toArray,void 0,""))
						.$_("to Array attrName needs to be provided. " + stringify(toArray,void 0,""));
		aFutureValues[toArray.attrName] = ow.obj.fromObj2Array(values, toArray.key);
		values = aFutureValues;
	}

	return sorting(values);
};

nAttrMon.prototype.addValues = function(onlyOnEvent, aOrigValues, aOptionals) {
	var count;

	aOptionals = _$(aOptionals).default({});
	
	if (isUnDef(aOrigValues) || isUnDef(aOrigValues.attributes)) return;
	var aMergeKeys = _$(aOptionals.mergeKeys).default(void 0);

	aMergeKeys = _$(aMergeKeys).isMap().default(void 0);

	var aValues = aOrigValues.attributes;
	aValues = this.posAttrProcessing(aOptionals, aValues);

	for(var key in aValues) {
		if (key.length > 0) {
			//aValues[key].name = key;

			if (!this.listOfAttributes.exists(key)) {
				this.setAttribute(key, key + " description");
			}

			this.listOfAttributes.touchAttribute(key);

			if(onlyOnEvent) {
				var av = this.currentValues.get({"name": key});
				if (isUnDef(av) ||
					!(stringify((new nAttributeValue(av)).getValue()) == stringify(aValues[key])) ) {
					var newAttr = new nAttributeValue(key, aValues[key]);
					this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() )) ;
					if (isDef(aMergeKeys) && isDef(aMergeKeys[key])) {
						var t = newAttr.getData();
						if (isObject(t.val) && !(isArray(t.val))) { t.val = [ t.val ]; };
						if (isArray(t.val) && isDef(av)) {
							t.val = _.concat(_.reject(av.val, aMergeKeys[key]), t.val);
						}
						if (isUnDef(this.currentValues.getSet({"name": key}, {"name": key}, t))) this.currentValues.set({"name": key}, t);
					} else {
						this.currentValues.set({"name": key}, newAttr.getData());
					}
				}
			} else {
				var av = this.currentValues.get({"name": key});
				var newAttr = new nAttributeValue(key, aValues[key]);
				this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() ));
				if (isDef(aMergeKeys) && isDef(aMergeKeys[key])) {
					var t = newAttr.getData();
					if (isObject(t.val) && !(isArray(t.val))) { t.val = [ t.val ]; };
					if (isArray(t.val) && isDef(av)) {
						t.val = _.concat(_.reject(av.val, aMergeKeys[key]), t.val);
					}
					if (isUnDef(this.currentValues.getSet({"name": key}, {"name": key}, t))) this.currentValues.set({"name": key}, t);
				} else {
					this.currentValues.set({"name": key}, newAttr.getData());
				}
			}
		}
	}
}

// --------------------------------------------------------------------------------------------
// Plugs
// --------------------------------------------------------------------------------------------

/**
 * <odoc>
 * <key>nattrmon.getPlugs() : Array</key>
 * Get the current array of plugs on nattrmon.
 * </odoc>
 */
nAttrMon.prototype.getPlugs = function() {
	return this.plugs;
};

nAttrMon.prototype.addSch = function(aName, aCronExpr, aFunc, waitForFinish) {
	if (isDef(this.schList[aName])) {
		this.sch.modifyEntry(this.schList[aName], aCronExpr, aFunc, waitForFinish);
	} else {
		var uuid = this.sch.addEntry(aCronExpr, aFunc, waitForFinish);
		this.schList[aName] = uuid;
	}

	return this.schList[aName];
};

nAttrMon.prototype.execPlugs = function(aPlugType) {
    for(var iPlug in this.plugs[aPlugType]) {
		try {
			var entry = this.plugs[aPlugType][iPlug];
			var parent = this;
			parent.thread = this.thread;

			var uuid;
			// Time based or initial meta for channel subscriber
			if (entry.aTime >= 0 || isDef(entry.chSubscribe)) {
				var f;
				if (entry.aTime >= 0) f = function(uuid) {
					var chpsi = new Date();
					try {
						var etry = parent.threadsSessions[uuid].entry;
						if (isDef(etry.getCron()) &&
							!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
							return false;
						}
						parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")");
						if (etry.waitForFinish && 
							$from($ch(parent.chPS).getAll())
							.equals("name", etry.getName())
							.equals("type", etry.type)
							.equals("uuid", uuid).any()) {
							return true;
						}
						$ch(parent.chPS).set({ name: etry.getName(), uuid: uuid, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: uuid, start: chpsi });
						var res;
						if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
							$tb()
							.stopWhen(() => {
								sleep(500);
								if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
									logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
									return true;
								} else {
									return false;
								}
							})
							.exec(() => { res = etry.exec(parent); return res; });
						} else {
							res = etry.exec(parent);
						}	
						parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
						parent.threadsSessions[uuid].count = now();
						etry.touch();
					} catch(e) {
						logErr(etry.getName() + " | " + e);
					} finally {
						$ch(parent.chPS).unset({ name: etry.getName(), uuid: uuid, start: chpsi });
					}

					return true;
				};

				try {
					if (entry.aTime > 0) {
						if (entry.waitForFinish) {
							this.debug("Starting with fixed rate for " + entry.getName() + " - " + entry.aTime);
							uuid = parent.thread.addScheduleThreadWithFixedDelay(f, entry.aTime);
						} else {
							this.debug("Starting at fixed rate for " + entry.getName() + " - " + entry.aTime);
							uuid = parent.thread.addScheduleThreadAtFixedRate(f, entry.aTime);
						}
					
						this.debug("Creating a thread for " + entry.getName() + " with uuid = " + uuid);
					} else {
						uuid = genUUID();
						if (isDef(entry.chSubscribe)) {
							this.debug("Creating subscriber for " + entry.getName() + " with uuid = " + uuid);
						}
					}

					parent.threadsSessions[uuid] = {
						"entry": this.plugs[aPlugType][iPlug],
						"count": now()
					};
					parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;		

					// One-time execution
					if (entry.aTime == 0) f(uuid);		
				} catch(e) {
					logErr("Problem starting thread for '" + entry.getName() + "' (uuid " + uuid + "): " + String(e));
				}
			}

			// If not time based
			if (entry.aTime <= 0) {
				// If channel subscriber
				if (isDef(entry.chSubscribe)) {
					var subs = function(aUUID) { 
						return function(aCh, aOp, aK, aV) {		
							var chpsi = new Date();			
							var cont = false;
							try {
								var etry = parent.threadsSessions[aUUID].entry;
								if (isDef(etry.getAttrPattern())) {
									var gap = etry.getAttrPattern();
									if (isString(gap)) {
										gap = [ gap ];
									}
									var api = 0;
									while(api < gap.length && !cont) {
										cont = (new RegExp(gap[api])).test(aK.name);
										api++;
									}
								} else {
									cont = true;
								}
								if (cont) {
									$ch(parent.chPS).set({ name: etry.getName(), uuid: aUUID, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: aUUID, start: chpsi });
									parent.debug("Subscriber " + aCh + " on '" + etry.getName() + "' (uuid " + aUUID + ") ");
									var res;

									var execRes = (aobj, amap) => {
										var r;
										if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
											$tb()
											.stopWhen(() => {
												sleep(500);
												if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
													logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
													return true;
												} else {
													return false;
												}
											})
											.exec(() => { r = etry.exec(aobj, amap); return true; });
										} else {
											r = etry.exec(aobj, amap);
										}
										
										return r;
									};

									if (etry.chHandleSetAll && aOp == "setall") {
										res = [];
										for(var ii in aV) {
											var r = execRes(parent, { ch: aCh, op: "set", k: ow.obj.filterKeys(aK, aV[ii]), v: aV[ii] });
											if (isArray(r)) {
												res = res.concat(r);
											} else {
												if (isObject(r)) {
													res.push(r);
												}
											}
										}
									} else {
										res = execRes(parent, { ch: aCh, op: aOp, k: aK, v: aV });
									}
									parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
									parent.threadsSessions[aUUID].count = now();
									etry.touch();
								}
							} catch(e) {
								logErr(etry.getName() + " | " + e);
							} finally {
								if (cont) $ch(parent.chPS).unset({ name: etry.getName(), uuid: aUUID, start: chpsi });
							}
						};
					};
					if (isArray(entry.chSubscribe)) {
						for(var i in entry.chSubscribe) {
							this.debug("Subscribing " + entry.chSubscribe + " for " + entry.getName() + "...");
							$ch(entry.chSubscribe).subscribe(subs(uuid));
						}
					} else {
						this.debug("Subscribing " + entry.chSubscribe + " for " + entry.getName() + "...");
						$ch(entry.chSubscribe).subscribe(subs(uuid));
					}
				} else {
				    // If cron based
					if (isDef(entry.getCron())) {
						var f = function(uuid) {
							try {
								var etry = parent.threadsSessions[uuid].entry;
								if (isDef(etry.getCron()) &&
									!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
									return false;
								}
								parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")");
								var chpsi = new Date();
								if (etry.waitForFinish && 
								    $from($ch(parent.chPS).getAll())
								    .equals("name", etry.getName())
								    .equals("type", etry.type)
								    .equals("uuid", uuid).any()) {
									parent.debug("Already executing '" + etry.getName() + "' (" + uuid +")");
								    return true;
								}
								$ch(parent.chPS).set({ name: etry.getName(), uuid: uuid, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: uuid, start: chpsi });
								var res;
								if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
									$tb()
									.stopWhen(() => {
										sleep(500);
										if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
											logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
											return true;
										} else {
											return false;
										}
									})
									.exec(() => { res = etry.exec(parent); return true; });
								} else {
									res = etry.exec(parent);
								}							
								$ch(parent.chPS).unset({ name: etry.getName(), uuid: uuid, start: chpsi });
								parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
								parent.threadsSessions[uuid].count = now();
								etry.touch();
							} catch(e) {
								logErr(etry.getName() + " | " + e);
							}
				
							return true;
						};

						uuid = this.addSch(entry.getName(), entry.getCron(), f, entry.getWaitForFinish());
						parent.threadsSessions[uuid] = {
							"entry": this.plugs[aPlugType][iPlug],
							"count": now()
						};
						parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;
					} else {
						this.debug("Muting " + entry.getName() + "' (uuid + " + uuid + ") ");
					}
				}
			}
		} catch(e) {
			logErr("Error loading plug: " + aPlugType + "::" + stringify(this.plugs[aPlugType][iPlug], void 0, "") + " | " + stringify(e));
		}
    }
};

nAttrMon.prototype.addPlug = function(aPlugType, aInputMeta, aObject, args) {
    if (isUnDef(this.plugs[aPlugType])) {
        this.plugs[aPlugType] = [];
    }

	if (isUnDef(aInputMeta.type)) aInputMeta.type = aPlugType;

    var plug = new nPlug(aInputMeta, args, aObject);

    var anyPlug = $from(this.plugs[aPlugType]).equals("aName", plug.getName()).equals("aCategory", plug.getCategory());
    if (anyPlug.any()) {
    	var i = this.plugs[aPlugType].indexOf(anyPlug.select()[0]);
    	this.plugs[aPlugType][i] = plug;
    	if (isDef(this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]))
    		this.threadsSessions[this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]].entry = plug;
    } else {
    	this.plugs[aPlugType].push(plug);
    }
    this.debug("Added plug " + plug.getName());
};

nAttrMon.prototype.addInput = function(aInputMeta, aInputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGINPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGINPUTS]).equals("aName", aInputMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGINPUTS + "::" + aInputMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGINPUTS + "::" + aInputMeta.name);
		}
	}
	this.addPlug(this.PLUGINPUTS, aInputMeta, aInputObject, args);
};

nAttrMon.prototype.addOutput = function(aOutputMeta, aOutputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGOUTPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGOUTPUTS]).equals("aName", aOutputMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name);
		}	
	}
	this.addPlug(this.PLUGOUTPUTS, aOutputMeta, aOutputObject, args);
};

nAttrMon.prototype.addValidation = function(aValidationMeta, aValidationObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGVALIDATIONS])) {
		var plug = $from(nattrmon.plugs[this.PLUGVALIDATIONS]).equals("aName", aValidationMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name);
		}	
	}
	this.addPlug(this.PLUGVALIDATIONS, aValidationMeta, aValidationObject, args);
};

nAttrMon.prototype.loadPlugs = function() {
	var parent = this;

	var getIgnoreList = (d) => {
		var res = [];
		if (io.fileExists(d + "/.nattrmonignore")) {
			var t = io.readFileAsArray(d + "/.nattrmonignore")
			res = $from(t).notStarts("#").notEquals("").match("[a-zA-Z0-9]+").select((r) => {
				var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim();
				return f;
			});
		} else {
			res = [];
		}

		if (io.fileExists(d + "/nattrmonignore.js")) {
			log("Executing '" + d + "/nattrmonignore.js'...");
			try {
				var fn = require(d + "/nattrmonignore.js");
				if (isUnDef(fn.getIgnoreList) || !isFunction(fn.getIgnoreList)) {
					logErr("nattrmonignore.js doesn't have a getIgnoreList function.");
				} else {
					var tmpRes = fn.getIgnoreList();
					tmpRes.forEach((r) => {
						var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim();
						res.push(f);
					});
				}
			} catch(e) {
				logErr("Problem with nattrmonignore.js: " + String(e));
			}
		}

		return res;
	};

	var ignoreList = getIgnoreList(this.configPath);
	this.ignoreList = ignoreList;
	parent.debug("Ignore list: " + stringify(ignoreList));

	if (!COREOBJECTS_LAZYLOADING) {
		if (isDef(COREOBJECTS)) 
			this.loadPlugDir(COREOBJECTS, "objects", ignoreList);
		else
			this.loadPlugDir(this.configPath + "/objects", "objects", ignoreList);
	} else {
		this.objectsPath = {};
		var parent = this;
		if (isDef(COREOBJECTS)) {
			$from(listFilesRecursive(COREOBJECTS))
			.equals("isFile", true)
			.sort("canonicalPath")
			.select(r => { 
				parent.objectsPath[r.filename] = r.filepath;
			});
		} else {
			$from(listFilesRecursive(this.configPath + "/objects"))
			.equals("isFile", true)
			.sort("canonicalPath")
			.select(r => { 
				parent.objectsPath[r.filename] = r.filepath;
			});
		}
	}

	this.loadPlugDir(this.configPath + "/inputs", "inputs", ignoreList);
	this.loadPlugDir(this.configPath + "/validations", "validations", ignoreList);
	this.loadPlugDir(this.configPath + "/outputs", "outputs", ignoreList);
};

/**
 * Creates the necessary internal objects (nInput, nOutput and nValidation) given an yaml definition.
 * 
 * yy   = object;
 * type = [input, output, validation]
 */
nAttrMon.prototype.loadObject = function(yy, type) {
	if (isUnDef(yy.args)) yy.args = {};
	if (isDef(yy.exec))
		switch (type) {
			case "input"     : yy.exec = new nInput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "output"    : yy.exec = new nOutput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "validation": yy.exec = new nValidation(new Function("var warns = arguments[0]; var scope = arguments[1]; var args = arguments[2]; " + yy.exec)); break;
		}
	if (isUnDef(yy.execArgs)) yy.execArgs = {};
	//if (!(isArray(yy.execArgs))) yy.execArgs = yy.execArgs;
	if (isDef(yy.execFrom)) {
		if (COREOBJECTS_LAZYLOADING && type != "objects") {
			var aPath;
			if (isDef(COREOBJECTS)) {
				aPath = COREOBJECTS + "/" + yy.execFrom + ".js";
			} else {
				aPath = this.configPath + "/objects/" + yy.execFrom + ".js";
			}
			if (!(this.isOnIgnoreList(aPath))) {
				this.debug("Lazy loading object " + aPath);
				this.loadPlug(aPath, "objects", this.ignoreList);
			}
		}
		var o = eval(yy.execFrom);
		yy.exec = Object.create(o.prototype);
		o.apply(yy.exec, [yy.execArgs]);
	}

	return yy;
}

nAttrMon.prototype.loadPlugDir = function(aPlugDir, aPlugDesc, ignoreList) {
    var files = io.listFiles(aPlugDir).files;

    var dirs = [];
    var plugsjs = [];

    for(var i in files) {
        if(files[i].isFile) {
            plugsjs.push(files[i].filepath);
        } else {
            dirs.push(files[i].filepath);
        }
    }

    dirs = dirs.sort();
    plugsjs = plugsjs.sort();

    for (let i in dirs) {
		var inc = true;
		for(let ii in ignoreList) { 
			if (dirs[i].indexOf(ignoreList[ii]) == 0 || 
			    dirs[i].match(new RegExp("^" + ignoreList[ii] + "$"))) inc = false; }
        if (inc) { this.loadPlugDir(dirs[i], aPlugDesc, ignoreList); } else { 
			logWarn("ignoring " + dirs[i]); 
			this.ignoreList.push(dirs[i]);
		}
    }

    for (let i in plugsjs) {
		var inc = true;
		for(let ii in ignoreList) { 
			if (plugsjs[i].indexOf(ignoreList[ii]) == 0 || 
			    plugsjs[i].match(new RegExp("^" + ignoreList[ii] + "$"))) inc = false; }		
		if (inc) { this.loadPlug(plugsjs[i], aPlugDesc, ignoreList); } else { 
			logWarn("ignoring " + plugsjs[i]);
			this.ignoreList.push(plugsjs[i]);
		}
    }
};

nAttrMon.prototype.isOnIgnoreList = function(aPath, ignoreList) {
	_$(aPath, "path").isString().$_();

	var inc = false;
	for(let ii in ignoreList) { 
		if (aPath.indexOf(ignoreList[ii]) == 0 || 
			aPath.match(new RegExp("^" + ignoreList[ii] + "$"))) inc = true; }

	return inc;
};

nAttrMon.prototype.loadPlug = function (aPlugFile, aPlugDesc, ignoreList) {
	if (isUnDef(aPlugDesc)) aPlugDesc = "";

	if (aPlugFile.match(/\.js$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			if (COREOBJECTS_LAZYLOADING && aPlugDesc != "objects") {
				var str = io.readFileString(aPlugFile);
				try {
					var ars = str.match(/new (nInput|nOutput|nValidation)([^\(]+)\(/g);
					for (var ii in ars) {
						var ar = ars[ii].match(/new (nInput|nOutput|nValidation)([^\(]+)\(/);
						if (isDef(ar) && isDef(ar[1]) && isDef(ar[2])) {
							var p = this.objectsPath[ar[1] + ar[2] + ".js"];

							if (!(this.isOnIgnoreList(p))) {
								this.debug("Lazy loading object " + p);
								this.loadPlug(p, "objects", ignoreList);
							}
						}
					}
				} catch(e) {
					logErr("Problem on object lazy loading triggered by '" + aPlugFile + "': " + String(e));
				}
			}
			af.load(aPlugFile);
		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
	if (aPlugFile.match(/\.yaml$/) || aPlugFile.match(/\.json$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			var y;
			if (aPlugFile.match(/\.yaml$/))
			   y = io.readFileYAML(aPlugFile);
			else
			   y = io.readFile(aPlugFile);

			var parent = this;

			function __handlePlug(yyy, type, parent) {
				var yy = parent.loadObject(yyy, type);

				switch (type) {
					case "input": parent.addInput(yy, yy.exec); break;
					case "output": parent.addOutput(yy, yy.exec); break;
					case "validation": parent.addValidation(yy, yy.exec); break;
				}
			}

			if (isDef(y.input))
				if (isArray(y.input))
					y.input.forEach(function (yo) { __handlePlug(yo, "input", parent) });
				else
					__handlePlug(y.input, "input", parent);
			if (isDef(y.output))
				if (isArray(y.output))
					y.output.forEach(function (yo) { __handlePlug(yo, "output", parent) });
				else
					__handlePlug(y.output, "output", parent);
			if (isDef(y.validation))
				if (isArray(y.validation))
					y.validation.forEach(function (yo) { __handlePlug(yo, "validation", parent) });
				else
					__handlePlug(y.validation, "validation", parent);
		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
}

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_HOME + "/config", params.debug || DEBUG);
} else {
	nattrmon = new nAttrMon(params.withDirectory, params.debug || DEBUG);
}

var __sleepperiod = 60000; // less aggressive
var __stuckfactor = 500;

// Option stop
if (isDef(params.stop)) {
	pidKill(ow.server.getPid(NATTRMON_HOME + "/nattrmon.pid"));
	exit(1);
}

ow.server.checkIn(NATTRMON_HOME + "/nattrmon.pid", function(aPid) {
	if (isDef(params.restart)) {
		log("Killing process " + ow.server.getPid(aPid));
                if (!pidKill(ow.server.getPid(aPid), false)) 
		   pidKill(ow.server.getPid(aPid), true);
		return true;
	} else {
 		if (isDef(params.stop)) {
			exit(0);	
 		}
		if (isDef(params.status)) {
 			var pid = ow.server.getPid(aPid);
			if (isDef(pid)) log("Running on pid = " + pid);
                }
		return false;
	}
}, function() {
	nattrmon.stop();
	log("nAttrMon stopped.");	
});

if (isDef(params.status)) {
   log("Not running");
   exit(0);
}

nattrmon.start();
log("nAttrMon started.");

ow.server.daemon(__sleepperiod, function() {
	// Check main health
	if ( (now() - nattrmon.count) >= (nattrmon.countCheck * __stuckfactor) ) {
		log("nAttrmon seems to be stuck.");
		log("nAttrMon restarting process!!");
		nattrmon.stop();
		restartOpenAF();
	}

	// Check all threads
	for(var uuid in nattrmon.threadsSessions) {
		if ( isUnDef(nattrmon.threadsSessions[uuid].entry.getCron()) && 
			 nattrmon.threadsSessions[uuid].entry.aTime > 0 && 
			 (now() - nattrmon.threadsSessions[uuid].count) >= (nattrmon.threadsSessions[uuid].entry.aTime * __stuckfactor) ) {
			log("nAttrmon found a stuck thread (" + uuid + " for '" + nattrmon.threadsSessions[uuid].entry.getName() + "')");
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");
print(new Date() + " | Stopping.");

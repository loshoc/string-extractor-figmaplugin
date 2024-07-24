/// <reference types="@figma/plugin-typings" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
figma.showUI(__html__, { width: 300, height: 220 });
figma.ui.onmessage = function (msg) { return __awaiter(_this, void 0, void 0, function () {
    var strings, error_1, errorMessage, jsonString, csvContent_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(msg.type === 'extract-strings' && msg.prefix !== undefined)) return [3 /*break*/, 5];
                figma.ui.resize(300, 480);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log('Extraction started:', { prefix: msg.prefix, extractAllPages: msg.extractAllPages });
                return [4 /*yield*/, extractStrings(msg.prefix, msg.extractAllPages || false)];
            case 2:
                strings = _a.sent();
                console.log('Extraction completed:', strings);
                figma.ui.postMessage({ type: 'extraction-result', strings: strings });
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error('Extraction error:', error_1);
                errorMessage = 'An unknown error occurred';
                if (error_1 instanceof Error) {
                    errorMessage = error_1.message;
                }
                else if (typeof error_1 === 'string') {
                    errorMessage = error_1;
                }
                figma.ui.postMessage({ type: 'extraction-error', error: errorMessage });
                return [3 /*break*/, 4];
            case 4: return [3 /*break*/, 6];
            case 5:
                if (msg.type === 'export-json' && msg.strings) {
                    jsonString = JSON.stringify(msg.strings, null, 2);
                    figma.ui.postMessage({ type: 'export-file', content: jsonString, fileType: 'application/json', fileName: 'extracted_strings.json' });
                }
                else if (msg.type === 'export-csv' && msg.strings) {
                    csvContent_1 = "Key,Value\n";
                    msg.strings.forEach(function (_a) {
                        var key = _a.key, value = _a.value;
                        csvContent_1 += "\"".concat(key, "\",\"").concat(value.replace(/"/g, '""'), "\"\n");
                    });
                    figma.ui.postMessage({ type: 'export-file', content: csvContent_1, fileType: 'text/csv;charset=utf-8;', fileName: 'extracted_strings.csv' });
                }
                _a.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); };
function extractStrings(prefix, extractAllPages) {
    return __awaiter(this, void 0, void 0, function () {
        function getStyledText(node) {
            var styledText = node.characters;
            switch (node.textCase) {
                case 'UPPER':
                    styledText = styledText.toUpperCase();
                    break;
                case 'LOWER':
                    styledText = styledText.toLowerCase();
                    break;
                case 'TITLE':
                    styledText = styledText.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
                    break;
            }
            return styledText;
        }
        function traverseNode(node) {
            return __awaiter(this, void 0, void 0, function () {
                var baseKey, styledText, key, _i, _a, child;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            console.log('Traversing node:', node.name, node.type);
                            if (node.type === 'TEXT' && node.name.startsWith(prefix)) {
                                baseKey = node.name.split(prefix)[1];
                                styledText = getStyledText(node);
                                key = "".concat(baseKey, "_").concat(styledText.replace(/\s+/g, '_').toLowerCase());
                                console.log('Found matching text node:', { key: key, value: styledText });
                                if (!stringsMap.has(styledText)) {
                                    stringsMap.set(styledText, { key: key, value: styledText });
                                }
                            }
                            if (!('children' in node)) return [3 /*break*/, 6];
                            if (!(node.type === 'PAGE')) return [3 /*break*/, 2];
                            return [4 /*yield*/, node.loadAsync()];
                        case 1:
                            _b.sent();
                            _b.label = 2;
                        case 2:
                            _i = 0, _a = node.children;
                            _b.label = 3;
                        case 3:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            child = _a[_i];
                            return [4 /*yield*/, traverseNode(child)];
                        case 4:
                            _b.sent();
                            _b.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        }
        var stringsMap, currentPage, selection, _i, _a, page, _b, selection_1, node, result;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    stringsMap = new Map();
                    currentPage = figma.currentPage;
                    selection = currentPage.selection;
                    console.log('Extraction settings:', { extractAllPages: extractAllPages, selectionLength: selection.length });
                    if (!extractAllPages) return [3 /*break*/, 6];
                    console.log('Extracting from all pages');
                    return [4 /*yield*/, figma.loadAllPagesAsync()];
                case 1:
                    _c.sent();
                    _i = 0, _a = figma.root.children;
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    page = _a[_i];
                    console.log('Processing page:', page.name);
                    return [4 /*yield*/, traverseNode(page)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 13];
                case 6:
                    if (!(selection.length > 0)) return [3 /*break*/, 11];
                    console.log('Extracting from selection');
                    _b = 0, selection_1 = selection;
                    _c.label = 7;
                case 7:
                    if (!(_b < selection_1.length)) return [3 /*break*/, 10];
                    node = selection_1[_b];
                    return [4 /*yield*/, traverseNode(node)];
                case 8:
                    _c.sent();
                    _c.label = 9;
                case 9:
                    _b++;
                    return [3 /*break*/, 7];
                case 10: return [3 /*break*/, 13];
                case 11:
                    console.log('Extracting from current page');
                    return [4 /*yield*/, traverseNode(currentPage)];
                case 12:
                    _c.sent();
                    _c.label = 13;
                case 13:
                    result = Array.from(stringsMap.values());
                    console.log('Extraction result:', result);
                    return [2 /*return*/, result];
            }
        });
    });
}

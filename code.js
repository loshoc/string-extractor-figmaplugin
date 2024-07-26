"use strict";
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
figma.showUI(__html__, { width: 300, height: 220 });
const instanceCache = new Map();
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'extract-strings' && msg.prefix !== undefined) {
        figma.ui.resize(300, 480);
        try {
            console.log('Extraction started:', { prefix: msg.prefix, extractAllPages: msg.extractAllPages });
            // Show loading toast
            const loadingToast = figma.notify('Extracting strings...', { timeout: Infinity });
            const strings = yield extractStrings(msg.prefix, msg.extractAllPages || false);
            console.log('Extraction completed:', strings);
            // Close loading toast
            loadingToast.cancel();
            // Show completion toast
            figma.notify('Extraction completed!', { timeout: 2000 });
            // Select the extracted text layers
            const nodesToSelect = [];
            for (const str of strings) {
                const node = yield figma.getNodeByIdAsync(str.nodeId);
                if (node && node.type === 'TEXT' && isNodeVisible(node)) {
                    nodesToSelect.push(node);
                }
            }
            if (!msg.extractAllPages) {
                figma.currentPage.selection = nodesToSelect;
            }
            else {
                // If extracting from all pages, only select nodes on the current page
                const currentPageNodes = nodesToSelect.filter(node => node.parent === figma.currentPage);
                figma.currentPage.selection = currentPageNodes;
            }
            // Send strings without nodeId to the UI
            const uiStrings = strings.map(({ key, value, hasNonTranslatable }) => ({ key, value, hasNonTranslatable }));
            figma.ui.postMessage({ type: 'extraction-result', strings: uiStrings });
        }
        catch (error) {
            console.error('Extraction error:', error);
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            else if (typeof error === 'string') {
                errorMessage = error;
            }
            figma.notify(`Extraction failed: ${errorMessage}`, { error: true });
            figma.ui.postMessage({ type: 'extraction-error', error: errorMessage });
        }
    }
    else if (msg.type === 'export-json' && msg.strings) {
        const exportStrings = msg.strings.map(({ key, value, hasNonTranslatable }) => ({ key, value, hasNonTranslatable }));
        const jsonString = JSON.stringify(exportStrings, null, 2);
        figma.ui.postMessage({ type: 'export-file', content: jsonString, fileType: 'application/json', fileName: 'extracted_strings.json' });
    }
    else if (msg.type === 'export-csv' && msg.strings) {
        let csvContent = "Key,Value,HasNonTranslatable\n";
        msg.strings.forEach(({ key, value, hasNonTranslatable }) => {
            csvContent += `"${key}","${value.replace(/"/g, '""')}",${hasNonTranslatable ? 'true' : 'false'}\n`;
        });
        figma.ui.postMessage({ type: 'export-file', content: csvContent, fileType: 'text/csv;charset=utf-8;', fileName: 'extracted_strings.csv' });
    }
});
function isNodeVisible(node) {
    let current = node;
    while (current && 'visible' in current) {
        if (!current.visible)
            return false;
        current = current.parent;
    }
    return true;
}
function extractStrings(prefix, extractAllPages) {
    return __awaiter(this, void 0, void 0, function* () {
        const stringsMap = new Map();
        const valueSet = new Set();
        instanceCache.clear(); // Clear the cache at the start of extraction
        function hasNonTranslatable(node) {
            return node.name.startsWith('nt_');
        }
        function getStyledText(node) {
            let styledText = node.characters;
            switch (node.textCase) {
                case 'UPPER':
                    styledText = styledText.toUpperCase();
                    break;
                case 'LOWER':
                    styledText = styledText.toLowerCase();
                    break;
                case 'TITLE':
                    styledText = styledText.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                    break;
            }
            return styledText;
        }
        function getUIPageInstance(node) {
            let current = node;
            let closestInstance = null;
            let closestHeightDifference = Infinity;
            while (current) {
                if (current.type === 'INSTANCE' && 'width' in current && 'height' in current) {
                    if (Math.abs(current.width - 375) < 0.1) {
                        let heightDifference = Math.abs(current.height - 812);
                        if (heightDifference < closestHeightDifference) {
                            // Update the closest instance and height difference
                            closestInstance = current;
                            closestHeightDifference = heightDifference;
                        }
                    }
                }
                current = current.parent;
            }
            // Return the instance with the closest height to 812px
            return closestInstance;
        }
        function getUIPageName(node) {
            if (instanceCache.has(node.id)) {
                return instanceCache.get(node.id);
            }
            const uiPageInstance = getUIPageInstance(node);
            if (uiPageInstance) {
                const uiPageName = uiPageInstance.name.split('/').pop() || 'Unknown';
                instanceCache.set(node.id, uiPageName);
                console.log(`UI Page Name found: ${uiPageName} for node: ${node.name}`);
                return uiPageName;
            }
            else {
                // Fallback: Find the nearest named parent frame or component
                let current = node.parent;
                while (current && current.type !== 'FRAME' && current.type !== 'COMPONENT') {
                    current = current.parent;
                }
                if (current && (current.type === 'FRAME' || current.type === 'COMPONENT')) {
                    const uiPageName = current.name.split('/').pop() || 'Unknown';
                    instanceCache.set(node.id, uiPageName);
                    console.log(`Fallback UI Page Name found: ${uiPageName} for node: ${node.name}`);
                    return uiPageName;
                }
            }
            console.log(`Using 'Unknown' as UI Page Name for node: ${node.name}`);
            return 'Unknown';
        }
        function generateUniqueKey(node, uiPageName, index) {
            const positionNumber = index.toString().padStart(1, '0');
            const shortId = node.id.slice(-6).replace(':', '_');
            const key = `${uiPageName}_${positionNumber}_${shortId}`;
            return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        }
        function processTextNodesInUIPage(textNodes, prefix, uiPageName) {
            return __awaiter(this, void 0, void 0, function* () {
                // Sort text nodes to maintain visual order (top-to-bottom, left-to-right)
                textNodes.sort((a, b) => {
                    if (a.y !== b.y)
                        return a.y - b.y;
                    return a.x - b.x;
                });
                for (let i = 0; i < textNodes.length; i++) {
                    const textNode = textNodes[i];
                    const uniqueKey = generateUniqueKey(textNode, uiPageName, i + 1);
                    const styledText = getStyledText(textNode);
                    const nonTranslatable = hasNonTranslatable(textNode);
                    if (!valueSet.has(styledText)) {
                        console.log('Found matching text node:', { key: uniqueKey, value: styledText, hasNonTranslatable: nonTranslatable });
                        const extractedString = {
                            key: uniqueKey,
                            value: styledText,
                            nodeId: textNode.id
                        };
                        if (nonTranslatable) {
                            extractedString.hasNonTranslatable = true;
                        }
                        stringsMap.set(uniqueKey, extractedString);
                        valueSet.add(styledText);
                    }
                    else {
                        console.log('Skipping duplicate value:', styledText);
                    }
                    // Yield to the main thread every 20 nodes
                    if (i % 20 === 0) {
                        yield new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            });
        }
        function traverseNode(node, prefix) {
            return __awaiter(this, void 0, void 0, function* () {
                const textNodesByUIPage = new Map();
                if (node.type === 'TEXT' && isNodeVisible(node) && (node.name.startsWith(prefix) || node.name.startsWith('nt_'))) {
                    const uiPageName = getUIPageName(node);
                    textNodesByUIPage.set(uiPageName, [node]);
                }
                else if ('findAllWithCriteria' in node) {
                    // Ensure the node is loaded if it's a page
                    if (node.type === 'PAGE' && !node.children.length) {
                        yield node.loadAsync();
                    }
                    const foundNodes = node.findAllWithCriteria({ types: ['TEXT'] });
                    const filteredNodes = foundNodes.filter(n => isNodeVisible(n) && (n.name.startsWith(prefix) || n.name.startsWith('nt_')));
                    for (const textNode of filteredNodes) {
                        const uiPageName = getUIPageName(textNode);
                        if (!textNodesByUIPage.has(uiPageName)) {
                            textNodesByUIPage.set(uiPageName, []);
                        }
                        textNodesByUIPage.get(uiPageName).push(textNode);
                    }
                }
                for (const [uiPageName, textNodes] of textNodesByUIPage) {
                    yield processTextNodesInUIPage(textNodes, prefix, uiPageName);
                }
            });
        }
        const nodesToProcess = [];
        if (extractAllPages) {
            console.log('Extracting from all pages');
            // Load all pages before processing
            yield figma.loadAllPagesAsync();
            nodesToProcess.push(...figma.root.children.filter(node => node.type === 'PAGE'));
        }
        else if (figma.currentPage.selection.length > 0) {
            console.log('Extracting from selection');
            nodesToProcess.push(...figma.currentPage.selection.filter(isNodeVisible));
        }
        else {
            console.log('Extracting from current page');
            nodesToProcess.push(figma.currentPage);
        }
        for (const node of nodesToProcess) {
            yield traverseNode(node, prefix);
        }
        const result = Array.from(stringsMap.values());
        console.log('Extraction result:', result);
        return result;
    });
}

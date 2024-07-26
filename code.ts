/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 300, height: 220 });

interface ExtractedString {
  key: string;
  value: string;
  nodeId: string;
  hasNonTranslatable?: boolean;
}

interface PluginMessage {
  type: string;
  prefix?: string;
  strings?: ExtractedString[];
  extractAllPages?: boolean;
}

const instanceCache = new Map<string, string>();

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'extract-strings' && msg.prefix !== undefined) {
    figma.ui.resize(300, 480);
    try {
      console.log('Extraction started:', { prefix: msg.prefix, extractAllPages: msg.extractAllPages });
      
      // Show loading toast
      const loadingToast = figma.notify('Extracting strings...', { timeout: Infinity });
      
      const strings = await extractStrings(msg.prefix, msg.extractAllPages || false);
      console.log('Extraction completed:', strings);
      
      // Close loading toast
      loadingToast.cancel();
      
      // Show completion toast
      figma.notify('Extraction completed!', { timeout: 2000 });
      
      // Select the extracted text layers
      const nodesToSelect: SceneNode[] = [];
      for (const str of strings) {
        const node = await figma.getNodeByIdAsync(str.nodeId);
        if (node && node.type === 'TEXT' && isNodeVisible(node)) {
          nodesToSelect.push(node);
        }
      }
      
      if (!msg.extractAllPages) {
        figma.currentPage.selection = nodesToSelect;
      } else {
        // If extracting from all pages, only select nodes on the current page
        const currentPageNodes = nodesToSelect.filter(node => node.parent === figma.currentPage);
        figma.currentPage.selection = currentPageNodes;
      }

      // Send strings without nodeId to the UI
      const uiStrings = strings.map(({ key, value, hasNonTranslatable }) => ({ key, value, hasNonTranslatable }));
      figma.ui.postMessage({ type: 'extraction-result', strings: uiStrings });
    } catch (error: unknown) {
      console.error('Extraction error:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      figma.notify(`Extraction failed: ${errorMessage}`, { error: true });
      figma.ui.postMessage({ type: 'extraction-error', error: errorMessage });
    }
  } else if (msg.type === 'export-json' && msg.strings) {
    const exportStrings = msg.strings.map(({ key, value, hasNonTranslatable }) => ({ key, value, hasNonTranslatable }));
    const jsonString = JSON.stringify(exportStrings, null, 2);
    figma.ui.postMessage({ type: 'export-file', content: jsonString, fileType: 'application/json', fileName: 'extracted_strings.json' });
  } else if (msg.type === 'export-csv' && msg.strings) {
    let csvContent = "Key,Value,HasNonTranslatable\n";
    msg.strings.forEach(({ key, value, hasNonTranslatable }) => {
      csvContent += `"${key}","${value.replace(/"/g, '""')}",${hasNonTranslatable ? 'true' : 'false'}\n`;
    });
    figma.ui.postMessage({ type: 'export-file', content: csvContent, fileType: 'text/csv;charset=utf-8;', fileName: 'extracted_strings.csv' });
  }
};

function isNodeVisible(node: SceneNode): boolean {
  let current: BaseNode | null = node;
  while (current && 'visible' in current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

async function extractStrings(prefix: string, extractAllPages: boolean): Promise<ExtractedString[]> {
  const stringsMap = new Map<string, ExtractedString>();
  const valueSet = new Set<string>();
  instanceCache.clear(); // Clear the cache at the start of extraction

  function hasNonTranslatable(node: TextNode): boolean {
    return node.name.startsWith('nt_');
  }

  function getStyledText(node: TextNode): string {
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

  function getUIPageInstance(node: SceneNode): InstanceNode | null {
    let current: BaseNode | null = node;
    let target375Instance: InstanceNode | null = null;
    let fallbackInstance: InstanceNode | null = null;

    while (current) {
      if (current.type === 'INSTANCE' && 'width' in current && 'height' in current) {
        if (Math.abs(current.width - 375) < 0.1) {
          if (current.height >= 812) {
            // Preferred instance found
            return current;
          } else if (!fallbackInstance) {
            // Keep this as a fallback if we don't find a taller instance
            fallbackInstance = current;
          }
        }
      }
      current = current.parent;
    }

    // Use the fallback if no preferred instance was found
    return fallbackInstance;
  }

  function getUIPageName(node: SceneNode): string {
    if (instanceCache.has(node.id)) {
      return instanceCache.get(node.id)!;
    }

    const uiPageInstance = getUIPageInstance(node);

    if (uiPageInstance) {
      const uiPageName = uiPageInstance.name.split('/').pop() || 'Unknown';
      instanceCache.set(node.id, uiPageName);
      console.log(`UI Page Name found: ${uiPageName} for node: ${node.name}`);
      return uiPageName;
    } else {
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

  function generateUniqueKey(node: TextNode, uiPageName: string, index: number): string {
    const positionNumber = index.toString().padStart(3, '0');
    const shortId = node.id.slice(-6).replace(':', '_');
    const key = `${uiPageName}_${positionNumber}_${shortId}`;
    return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  }

  async function processTextNodesInUIPage(textNodes: TextNode[], prefix: string, uiPageName: string) {
    textNodes.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      const uniqueKey = generateUniqueKey(textNode, uiPageName, i + 1);
      const styledText = getStyledText(textNode);
      const nonTranslatable = hasNonTranslatable(textNode);
      
      if (!valueSet.has(styledText)) {
        console.log('Found matching text node:', { key: uniqueKey, value: styledText, hasNonTranslatable: nonTranslatable });
        const extractedString: ExtractedString = { 
          key: uniqueKey, 
          value: styledText, 
          nodeId: textNode.id
        };
        if (nonTranslatable) {
          extractedString.hasNonTranslatable = true;
        }
        stringsMap.set(uniqueKey, extractedString);
        valueSet.add(styledText);
      } else {
        console.log('Skipping duplicate value:', styledText);
      }

      // Yield to the main thread every 20 nodes
      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  async function traverseNode(node: BaseNode, prefix: string) {
    const textNodesByUIPage = new Map<string, TextNode[]>();

    if (node.type === 'TEXT' && isNodeVisible(node) && (node.name.startsWith(prefix) || node.name.startsWith('nt_'))) {
      const uiPageName = getUIPageName(node);
      textNodesByUIPage.set(uiPageName, [node]);
    } else if ('findAllWithCriteria' in node) {
      // Ensure the node is loaded if it's a page
      if (node.type === 'PAGE' && !node.children.length) {
        await node.loadAsync();
      }
      
      const foundNodes = node.findAllWithCriteria({ types: ['TEXT'] });
      const filteredNodes = foundNodes.filter(n => isNodeVisible(n) && (n.name.startsWith(prefix) || n.name.startsWith('nt_')));
      
      for (const textNode of filteredNodes) {
        const uiPageName = getUIPageName(textNode);
        if (!textNodesByUIPage.has(uiPageName)) {
          textNodesByUIPage.set(uiPageName, []);
        }
        textNodesByUIPage.get(uiPageName)!.push(textNode);
      }
    }

    for (const [uiPageName, textNodes] of textNodesByUIPage) {
      await processTextNodesInUIPage(textNodes, prefix, uiPageName);
    }
  }

  const nodesToProcess: BaseNode[] = [];

  if (extractAllPages) {
    console.log('Extracting from all pages');
    // Load all pages before processing
    await figma.loadAllPagesAsync();
    nodesToProcess.push(...figma.root.children.filter(node => node.type === 'PAGE'));
  } else if (figma.currentPage.selection.length > 0) {
    console.log('Extracting from selection');
    nodesToProcess.push(...figma.currentPage.selection.filter(isNodeVisible));
  } else {
    console.log('Extracting from current page');
    nodesToProcess.push(figma.currentPage);
  }

  for (const node of nodesToProcess) {
    await traverseNode(node, prefix);
  }

  const result = Array.from(stringsMap.values());
  console.log('Extraction result:', result);
  return result;
}
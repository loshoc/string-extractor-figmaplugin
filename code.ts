/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 300, height: 220 });

interface ExtractedString {
  key: string;
  value: string;
  nodeId: string;
}

interface PluginMessage {
  type: string;
  prefix?: string;
  strings?: ExtractedString[];
  extractAllPages?: boolean;
}

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'extract-strings' && msg.prefix !== undefined) {
    figma.ui.resize(300, 480);
    try {
      console.log('Extraction started:', { prefix: msg.prefix, extractAllPages: msg.extractAllPages });
      const strings = await extractStrings(msg.prefix, msg.extractAllPages || false);
      console.log('Extraction completed:', strings);
      
      // Select the extracted text layers
      const nodesToSelect: SceneNode[] = [];
      for (const str of strings) {
        const node = await figma.getNodeByIdAsync(str.nodeId);
        if (node) nodesToSelect.push(node as SceneNode);
      }
      
      if (!msg.extractAllPages) {
        figma.currentPage.selection = nodesToSelect;
      } else {
        figma.currentPage.selection = [];
      }

      // Send strings without nodeId to the UI
      const uiStrings = strings.map(({ key, value }) => ({ key, value }));
      figma.ui.postMessage({ type: 'extraction-result', strings: uiStrings });
    } catch (error: unknown) {
      console.error('Extraction error:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      figma.ui.postMessage({ type: 'extraction-error', error: errorMessage });
    }
  } else if (msg.type === 'export-json' && msg.strings) {
    // Exclude nodeId from the exported strings
    const exportStrings = msg.strings.map(({ key, value }) => ({ key, value }));
    const jsonString = JSON.stringify(exportStrings, null, 2);
    figma.ui.postMessage({ type: 'export-file', content: jsonString, fileType: 'application/json', fileName: 'extracted_strings.json' });
  } else if (msg.type === 'export-csv' && msg.strings) {
    // Exclude nodeId from the exported strings
    let csvContent = "Key,Value\n";
    msg.strings.forEach(({ key, value }) => {
      csvContent += `"${key}","${value.replace(/"/g, '""')}"\n`;
    });
    figma.ui.postMessage({ type: 'export-file', content: csvContent, fileType: 'text/csv;charset=utf-8;', fileName: 'extracted_strings.csv' });
  }
};

async function extractStrings(prefix: string, extractAllPages: boolean): Promise<ExtractedString[]> {
  const stringsMap = new Map<string, ExtractedString>();

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

  async function traverseNode(node: BaseNode) {
    console.log('Traversing node:', node.name, node.type);
    if (node.type === 'TEXT' && node.name.startsWith(prefix)) {
      const baseKey = node.name.split(prefix)[1];
      const styledText = getStyledText(node);
      const key = `${baseKey}_${styledText.replace(/\s+/g, '_').toLowerCase()}`;
      
      console.log('Found matching text node:', { key, value: styledText });
      if (!stringsMap.has(styledText)) {
        stringsMap.set(styledText, { key, value: styledText, nodeId: node.id });
      }
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        await traverseNode(child);
      }
    }
  }

  const currentPage = figma.currentPage;
  const selection = currentPage.selection;

  console.log('Extraction settings:', { extractAllPages, selectionLength: selection.length });

  if (extractAllPages) {
    console.log('Extracting from all pages');
    await figma.loadAllPagesAsync();
    for (const page of figma.root.children) {
      if (page.type === 'PAGE') {
        console.log('Processing page:', page.name);
        await page.loadAsync();
        await traverseNode(page);
      }
    }
  } else if (selection.length > 0) {
    console.log('Extracting from selection');
    for (const node of selection) {
      await traverseNode(node);
    }
  } else {
    console.log('Extracting from current page');
    await traverseNode(currentPage);
  }

  const result = Array.from(stringsMap.values());
  console.log('Extraction result:', result);
  return result;
}

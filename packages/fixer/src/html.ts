import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Element, Properties, Root } from 'hast';

const ANALYTICS_PATTERNS = [/googletagmanager/i, /gtag/i, /plausible/i];
const VIEWPORT_CONTENT = 'width=device-width,initial-scale=1';
const CHARSET_NAMES = ['charset', 'charSet'];

export function applyFixes(html: string): string {
  const processor = unified()
    .use(rehypeParse, { fragment: false })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const tree = processor.parse(html) as Root;

  visit(tree, 'element', (node: Element) => {
    if (node.tagName === 'img') {
      ensureLazyLoading(node);
    } else if (node.tagName === 'script') {
      ensureScriptDefer(node);
    } else if (node.tagName === 'head') {
      ensureHeadMeta(node);
    }
  });

  const transformed = processor.runSync(tree) as Root;
  return processor.stringify(transformed).toString();
}

function ensureLazyLoading(node: Element): void {
  const properties = (node.properties ??= {});
  if (!('loading' in properties) || properties.loading === undefined || properties.loading === null) {
    properties.loading = 'lazy';
  }
}

function ensureScriptDefer(node: Element): void {
  const properties = (node.properties ??= {});
  const src = typeof properties.src === 'string' ? properties.src : undefined;

  if (!src || ANALYTICS_PATTERNS.some((pattern) => pattern.test(src))) {
    return;
  }

  if (properties.type === 'module' || 'defer' in properties || 'async' in properties) {
    return;
  }

  const hasInlineCode = Array.isArray(node.children)
    ? node.children.some((child) => child.type === 'text' && child.value.trim() !== '')
    : false;

  if (hasInlineCode) {
    return;
  }

  properties.defer = true;
}

function ensureHeadMeta(node: Element): void {
  node.children = node.children ?? [];

  const charsetMeta = node.children.find(isMetaWithCharset);

  if (!charsetMeta) {
    node.children.unshift(createMeta({ charset: 'utf-8' }));
  } else {
    const props = (charsetMeta.properties ??= {});
    const current = getFirstStringProperty(props, CHARSET_NAMES);
    if (!current || current.toLowerCase() !== 'utf-8') {
      setStringProperty(props, 'charset', 'utf-8', CHARSET_NAMES);
    }
  }

  const viewportMeta = node.children.find((child) => isMetaByName(child, 'viewport')) as Element | undefined;

  if (!viewportMeta) {
    node.children.push(createMeta({ name: 'viewport', content: VIEWPORT_CONTENT }));
  } else {
    const properties = (viewportMeta.properties ??= {} as Properties);
    properties.content = VIEWPORT_CONTENT;
  }
}

function isMetaWithCharset(node: Element['children'][number]): node is Element {
  if (!(node?.type === 'element' && node.tagName === 'meta')) {
    return false;
  }
  return !!node.properties && CHARSET_NAMES.some((name) => typeof (node.properties as Properties)[name] === 'string');
}

function isMetaByName(node: Element['children'][number], name: string): node is Element {
  if (!(node?.type === 'element' && node.tagName === 'meta' && node.properties)) {
    return false;
  }

  const prop = node.properties.name;
  if (typeof prop === 'string') {
    return prop.toLowerCase() === name.toLowerCase();
  }

  if (Array.isArray(prop)) {
    return prop.some((value) => typeof value === 'string' && value.toLowerCase() === name.toLowerCase());
  }

  return false;
}

function getFirstStringProperty(properties: Properties, names: string[]): string | undefined {
  for (const name of names) {
    const value = properties[name];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

function setStringProperty(properties: Properties, primary: string, value: string, aliases: string[]): void {
  properties[primary] = value;
  for (const alias of aliases) {
    if (alias !== primary) {
      delete properties[alias];
    }
  }
}

function createMeta(properties: Properties): Element {
  return {
    type: 'element',
    tagName: 'meta',
    properties,
    children: []
  };
}

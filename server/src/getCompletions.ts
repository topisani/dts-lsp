import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { ContextAware } from "./runtimeEvaluator";
import { SearchableResult } from "./types";
import { Node } from "./context/node";
import { ASTBase } from "./ast/base";
import { DeleteBase } from "./ast/dtc/delete";
import { Keyword } from "./ast/keyword";
import { DtcProperty, PropertyName } from "./ast/dtc/property";
import {
  DtcChildNode,
  DtcRefNode,
  DtcRootNode,
  NodeName,
} from "./ast/dtc/node";
import { DeleteNode } from "./ast/dtc/deleteNode";
import { LabelAssign } from "./ast/dtc/label";
import { NodePath } from "./ast/dtc/values/nodePath";
import { Property } from "./context/property";
import { LabelRef } from "./ast/dtc/labelRef";
import { nodeFinder } from "./helpers";
import { DeleteProperty } from "./ast/dtc/deleteProperty";

const resolveNonDeletedScopedLabels = (
  node: Node,
  inScope: (ast: ASTBase) => boolean
): LabelAssign[] => {
  return [
    ...node.labels.filter(inScope),
    ...node.deletedNodes
      .filter((n) => !inScope(n.by))
      .flatMap((n) => resolveNonDeletedScopedLabels(n.node, inScope)),
    ...node.nodes.flatMap((n) => resolveNonDeletedScopedLabels(n, inScope)),
  ];
};

const resolveNonDeletedLabels = (
  node: Node,
  inScope: (ast: ASTBase) => boolean
): LabelAssign[] => {
  return [
    ...node.labels,
    ...node.deletedNodes
      .filter((n) => !inScope(n.by))
      .flatMap((n) => resolveNonDeletedLabels(n.node, inScope)),
    ...node.nodes.flatMap((n) => resolveNonDeletedLabels(n, inScope)),
  ];
};

function getPropertyAssignItems(
  result: SearchableResult | undefined
): CompletionItem[] {
  if (
    !result ||
    !(result.item instanceof Property) ||
    !(result.ast instanceof DtcProperty)
  ) {
    return [];
  }

  return (
    result.item.parent.nodeType.properties
      .find((p) => p.name === result.item?.name)
      ?.getPropertyCompletionItems(result.ast) ?? []
  );
}

function getRefLabelsItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  if (
    !result ||
    !(result.item instanceof Property) ||
    !(result.ast instanceof LabelRef)
  ) {
    return [];
  }

  const getScopeItems = (node: Node) => {
    return resolveNonDeletedLabels(node, inScope);
  };

  return Array.from(
    new Set(getScopeItems(result.runtime.rootNode).map((l) => l.label))
  ).map((l) => ({
    label: `${l}`,
    kind: CompletionItemKind.Method,
  }));
}

function getCreateNodeRefItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  if (
    !result ||
    result.item !== null ||
    !(result.ast instanceof LabelRef) ||
    !(result.ast.parentNode instanceof DtcRefNode)
  ) {
    return [];
  }

  const getScopeItems = (node: Node) => {
    return resolveNonDeletedScopedLabels(node, inScope).filter((l) =>
      inScope(l)
    );
  };

  return [
    ...Array.from(
      new Set(getScopeItems(result.runtime.rootNode).map((l) => l.label))
    ).map((l) => ({
      label: l,
      insertText: `${l} {\n$1\n};`,
      kind: CompletionItemKind.Value,
      insertTextFormat: InsertTextFormat.Snippet,
    })),
  ];
}

function getDeleteNodeRefItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  const isNodeDeleteChild = (ast?: ASTBase): boolean => {
    if (!ast) return false;
    return ast instanceof DeleteNode ? true : isNodeDeleteChild(ast.parentNode);
  };

  const isRefDeleteNode = (ast?: ASTBase): boolean => {
    if (!ast) return true;
    if (
      ast.parentNode instanceof DtcRefNode ||
      ast.parentNode instanceof DtcRootNode ||
      ast.parentNode instanceof DtcChildNode
    ) {
      return false;
    }
    return isRefDeleteNode(ast.parentNode);
  };

  if (
    !result ||
    result.item !== null ||
    !isNodeDeleteChild(result.ast) ||
    !isRefDeleteNode(result.ast)
  ) {
    return [];
  }

  const getScopeItems = (node: Node) => {
    return resolveNonDeletedScopedLabels(node, inScope).filter((l) =>
      inScope(l)
    );
  };

  if (result.ast instanceof Keyword) {
    if (getScopeItems(result.runtime.rootNode).length) {
      return [
        {
          label: "/delete-node/",
          kind: CompletionItemKind.Keyword,
        },
      ];
    }

    if (result.runtime.rootNode.nodes.length) {
      return [
        {
          label: "/delete-node/ &{}",
          insertText: `/delete-node/ &{/$1};`,
          kind: CompletionItemKind.Value,
          insertTextFormat: InsertTextFormat.Snippet,
        },
      ];
    }

    return [];
  }

  return Array.from(
    new Set(getScopeItems(result.runtime.rootNode).map((l) => l.label))
  ).map((l) => ({
    label: result.ast instanceof DeleteNode ? `&${l};` : `${l};`,
    kind: CompletionItemKind.Variable,
  }));
}

function getDeleteNodeNameItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  if (!result || !(result.item instanceof Node) || result.item === null) {
    return [];
  }

  const getScopeItems = (node: Node) => {
    return [
      ...node.nodes,
      ...node.deletedNodes.filter((n) => !inScope(n.by)).map((n) => n.node),
    ]
      .flatMap(
        (n) =>
          n.definitons.filter(
            (n) => n instanceof DtcChildNode
          ) as DtcChildNode[]
      )
      .filter((n) => inScope(n));
  };

  if (result.ast instanceof Keyword) {
    if (getScopeItems(result.item).length) {
      return [
        {
          label: "/delete-node/",
          insertText: `/delete-node/$1;`,
          kind: CompletionItemKind.Value,
          insertTextFormat: InsertTextFormat.Snippet,
        },
      ];
    }
    return [];
  }

  if (result.ast instanceof NodeName || result.ast instanceof DeleteNode) {
    return Array.from(
      new Set(getScopeItems(result.item).map((r) => r.name?.toString()))
    ).map((n) => ({
      label: `${n}`,
      kind: CompletionItemKind.Variable,
    }));
  }

  return [];
}

function getDeletePropertyItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  if (
    !result ||
    !(result.item instanceof Node) ||
    !(
      result.ast.parentNode instanceof DeleteBase ||
      result.ast instanceof DeleteBase
    )
  ) {
    return [];
  }

  const getSopeItems = (node: Node) => {
    return [
      ...node.properties,
      ...node.deletedProperties
        .filter((n) => !inScope(n.by))
        .map((n) => n.property),
    ]
      .flatMap((p) => [p, ...p.allReplaced])
      .filter((p) => inScope(p.ast));
  };

  if (result.ast instanceof Keyword) {
    if (getSopeItems(result.item).length) {
      return [
        {
          label: "/delete-property/",
          insertText: `/delete-property/$1;`,
          kind: CompletionItemKind.Value,
          insertTextFormat: InsertTextFormat.Snippet,
        },
      ];
    }
    return [];
  }

  if (
    result.ast instanceof PropertyName ||
    result.ast instanceof DeleteProperty
  ) {
    return Array.from(
      new Set(getSopeItems(result.item).map((p) => p.name))
    ).map((p) => ({
      label: `${p}`,
      kind: CompletionItemKind.Variable,
    }));
  }

  return [];
}

function getNodeRefPathsItems(
  result: SearchableResult | undefined,
  inScope: (ast: ASTBase) => boolean
): CompletionItem[] {
  const nodePathObj: ASTBase | undefined =
    result?.ast instanceof NodePath ? result.ast : result?.ast.parentNode;

  if (!result || !nodePathObj || !(nodePathObj instanceof NodePath)) {
    return [];
  }
  const nodePathTemp = nodePathObj.pathParts.slice(0, -1);

  if (nodePathTemp.some((p) => !p)) {
    return [];
  }

  const nodePath = (nodePathTemp as NodeName[]).map((p) => p.toString());

  const getSopeItems = () => {
    const parentNode = result.runtime.rootNode.getChildFromScope(
      ["/", ...nodePath],
      inScope
    );

    const isDeleteChild = (ast: ASTBase): boolean => {
      if (ast instanceof DeleteBase) {
        return true;
      }

      return ast.parentNode ? isDeleteChild(ast.parentNode) : false;
    };

    return (
      [
        ...(parentNode?.nodes.filter(
          (n) => !isDeleteChild(result.ast) || n.definitons.some(inScope)
        ) ?? []),
        ...(parentNode?.deletedNodes
          .filter((n) => !inScope(n.by))
          .map((n) => n.node) ?? []),
      ].map((n) => n.fullName) ?? []
    );
  };

  return getSopeItems().map((p) => ({
    label: `/${[...nodePath, p].join("/")}`,
    kind: CompletionItemKind.Variable,
  }));
}

export async function getCompletions(
  location: TextDocumentPositionParams,
  context: ContextAware[]
): Promise<CompletionItem[]> {
  return nodeFinder(location, context, (locationMeta, inScope) => [
    ...getDeletePropertyItems(locationMeta, inScope),
    ...getDeleteNodeNameItems(locationMeta, inScope),
    ...getDeleteNodeRefItems(locationMeta, inScope),
    ...getNodeRefPathsItems(locationMeta, inScope),
    ...getCreateNodeRefItems(locationMeta, inScope),
    ...getRefLabelsItems(locationMeta, inScope),
    ...getPropertyAssignItems(locationMeta),
  ]);
}

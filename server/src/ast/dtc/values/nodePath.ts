import { ASTBase } from '../../base';
import { toRange } from '../../../helpers';
import { BuildSemanticTokensPush } from '../../../types';
import { Label } from '../label';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { NodeName } from '../node';

export class NodePath extends ASTBase {
	pathParts: (NodeName | null)[] = [];

	constructor() {
		super();
		this.semanticTokenType = 'variable';
		this.semanticTokenModifiers = 'declaration';
	}

	getDocumentSymbols(): DocumentSymbol[] {
		return [
			{
				name: this.pathParts.join('/'),
				kind: SymbolKind.Key,
				range: toRange(this),
				selectionRange: toRange(this),
			},
		];
	}
}

export class NodePathRef extends ASTBase {
	constructor(public readonly path: NodePath | null) {
		super();
		this.semanticTokenType = 'variable';
		this.semanticTokenModifiers = 'declaration';
	}

	getDocumentSymbols(): DocumentSymbol[] {
		return [
			{
				name: 'Node Path Referance',
				kind: SymbolKind.Variable,
				range: toRange(this),
				selectionRange: toRange(this),
				children: this.path?.getDocumentSymbols(),
			},
		];
	}
}

export class NodePathValue extends ASTBase {
	constructor(public readonly path: NodePathRef | null, public readonly labels: Label[]) {
		super();
	}

	getDocumentSymbols(): DocumentSymbol[] {
		return [
			{
				name: 'Node Path',
				kind: SymbolKind.Variable,
				range: toRange(this),
				selectionRange: toRange(this),
				children: this.path?.getDocumentSymbols(),
			},
		];
	}

	buildSemanticTokens(builder: BuildSemanticTokensPush) {
		this.path?.buildSemanticTokens(builder);
		this.labels.forEach((label) => label.buildSemanticTokens(builder));
	}
}

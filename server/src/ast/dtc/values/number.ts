import { SymbolKind } from 'vscode-languageserver';
import { Expression } from '../../cPreprocessors/expression';

export class NumberValue extends Expression {
	constructor(public readonly value: number) {
		super();
		this.docSymbolsMeta = {
			name: this.value.toString(),
			kind: SymbolKind.Number,
		};
		this.semanticTokenType = 'number';
		this.semanticTokenModifiers = 'declaration';
	}

	evaluate(): string {
		throw new Error('Not Implimented');
	}
}

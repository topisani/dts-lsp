import { DtcChildNode, DtcRefNode, DtcRootNode } from '../ast/dtc/node';
import { ContextIssues, Issue, Searchable, SearchableResult } from '../types';
import { Property } from './property';
import { DeleteProperty } from '../ast/dtc/deleteProperty';
import { DeleteNode } from '../ast/dtc/deleteNode';
import { positionInBetween } from '../helpers';
import { DiagnosticSeverity, DiagnosticTag, Position } from 'vscode-languageserver';
import { LabelAssign } from '../ast/dtc/label';
import { ASTBase } from 'src/ast/base';
import { Node } from './node';

export class Runtime implements Searchable {
	public roots: DtcRootNode[] = [];
	public referances: DtcRefNode[] = [];
	public unlinkedDeletes: DeleteNode[] = [];
	public rootNode: Node = new Node('/');

	getDeepestAstNode(file: string, position: Position): SearchableResult {
		// return this.rootNode.getDeepestAstNode(file, position) ?? ;
		const inNode = [...this.roots, ...this.referances, ...this.unlinkedDeletes].find((i) =>
			positionInBetween(i, file, position)
		);

		let _node: Node | undefined;
		const getNode = () => {
			return _node ?? this.rootNode;
		};

		if (inNode instanceof DtcRefNode) {
			_node = this.rootNode.getReferenceBy(inNode);
		}

		if (inNode) {
			let deepestAstNode: ASTBase | undefined = inNode;
			let next: ASTBase | undefined = inNode;
			while (next) {
				deepestAstNode = next;
				next = deepestAstNode.children
					.reverse()
					.find((c) => positionInBetween(c, file, position));
			}

			return {
				item: getNode(),
				ast: deepestAstNode,
			};
		}

		return;
	}

	get issues(): Issue<ContextIssues>[] {
		return [...this.labelIssues(), ...this.rootNode.issues];
	}

	private labelIssues() {
		const issues: Issue<ContextIssues>[] = [];

		const lablesUsed = new Map<
			string,
			{
				label: LabelAssign;
				owner: Property | Node | null;
				skip?: boolean;
			}[]
		>();

		this.rootNode.allDescendantsLabelsMapped.forEach((item) => {
			if (!lablesUsed.has(item.label.label)) {
				lablesUsed.set(item.label.label, [item]);
			} else {
				lablesUsed.get(item.label.label)?.push(item);
			}
		});

		Array.from(lablesUsed).forEach((pair) => {
			const otherOwners = pair[1];
			if (otherOwners.length > 1) {
				const firstLabeledNode = otherOwners.find((o) => o.owner instanceof Node);

				const allSameOwner = otherOwners.every(
					(owner) => owner && owner.owner === firstLabeledNode?.owner
				);

				if (!allSameOwner || !firstLabeledNode) {
					const conflits = otherOwners.filter(
						(owner) => !(owner && owner.owner === firstLabeledNode?.owner)
					);

					issues.push(
						this.genIssue(
							ContextIssues.LABEL_ALREADY_IN_USE,
							otherOwners.at(0)!.label,
							DiagnosticSeverity.Error,
							otherOwners.slice(1).map((o) => o.label),
							[],
							[otherOwners.at(0)!.label.label]
						)
					);
				}
			}
		});

		return issues;
	}

	private genIssue = (
		issue: ContextIssues | ContextIssues[],
		slxBase: ASTBase,
		severity: DiagnosticSeverity = DiagnosticSeverity.Error,
		linkedTo: ASTBase[] = [],
		tags: DiagnosticTag[] | undefined = undefined,
		templateStrings: string[] = []
	): Issue<ContextIssues> => ({
		issues: Array.isArray(issue) ? issue : [issue],
		astElement: slxBase,
		severity,
		linkedTo,
		tags,
		templateStrings,
	});
}

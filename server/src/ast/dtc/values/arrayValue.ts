/*
 * Copyright 2024 Kyle Micallef Bonnici
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ASTBase } from "../../base";
import { SymbolKind } from "vscode-languageserver";
import { LabelRef } from "../labelRef";
import { NodePathRef } from "./nodePath";
import { NumberValue } from "./number";
import { LabeledValue } from "./labeledValue";
import { Expression } from "../../cPreprocessors/expression";
import { Token } from "src/types";

export class ArrayValues extends ASTBase {
  public openBracket?: Token;
  public closeBracket?: Token;

  constructor(
    public readonly values: LabeledValue<
      NumberValue | LabelRef | NodePathRef | Expression
    >[]
  ) {
    super();
    this.docSymbolsMeta = {
      name: "Cell Array",
      kind: SymbolKind.Array,
    };
    this.values.forEach((value) => this.addChild(value));
  }

  toString() {
    return `<${this.values.map((v) => v.toString()).join(" ")}>`;
  }
}

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

import { StandardTypeIssue } from "../../types";
import { genIssue } from "../../helpers";
import { PropertyNodeType, PropertyType } from "../types";
import { generateOrTypeObj, getU32ValueFromProperty } from "./helpers";
import { DiagnosticSeverity } from "vscode-languageserver";
import { ASTBase } from "../../ast/base";

export default () =>
  new PropertyNodeType(
    "phandle",
    generateOrTypeObj(PropertyType.U32),
    "optional",
    undefined,
    [],
    (property) => {
      const phandelValue = getU32ValueFromProperty(property, 0, 0);
      if (phandelValue) {
        const nodes = property.parent.root.getAllPhandle(phandelValue);
        if (nodes.length > 1 && nodes.at(-1) === property.parent) {
          return [
            genIssue(
              StandardTypeIssue.EXPECTED_UNIQUE_PHANDLE,
              property.ast.values?.values.at(0) ?? property.ast,
              DiagnosticSeverity.Error,
              nodes
                .slice(0, -1)
                .flatMap((n) => n.getProperty("phandle")?.ast)
                .filter((a) => !!a) as ASTBase[],
              [],
              [property.name]
            ),
          ];
        }
      }
      return [];
    }
  );

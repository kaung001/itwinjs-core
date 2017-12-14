/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { ECInstanceKeysList } from "../common/EC";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "../common/Hierarchy";
import * as content from "../common/Content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "../common/Changes";
import { PageOptions, ECPresentationManager as ECPInterface } from "../common/ECPresentationManager";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
// import { NodeAddonRegistry } from "@bentley/imodeljs-backend/lib/backend/NodeAddonRegistry";
// import { NodeAddonECPresentationManager } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { IModelError, IModelStatus } from "@bentley/imodeljs-backend/lib/common/IModelError";
import { IModelDb } from "@bentley/imodeljs-backend/lib/backend/IModelDb";
import ECPresentationGatewayImpl from "./ECPresentationGatewayImpl";

// Register the backend implementation of IModelGateway
ECPresentationGatewayImpl.register();

export default class ECPresentationManager implements ECPInterface {
  // private _manager: NodeAddonECPresentationManager;

  constructor() {
    // this._manager = new (NodeAddonRegistry.getAddon()).NodeAddonECPresentationManager();
  }

  public async getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams("GetRootNodes", {
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getRootNodesCount(_token: IModelToken, _options: object): Promise<number> {
    /*const params = this.createRequestParams("GetRootNodesCount", {
      options,
    });
    return this.request(token, params);*/
    return 789789;
  }

  public async getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<NavNode[]> {
    const params = this.createRequestParams("GetChildren", {
      nodeId: parent.nodeId,
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number> {
    const params = this.createRequestParams("GetChildrenCount", {
      nodeId: parent.nodeId,
      options,
    });
    return this.request(token, params);
  }

  public async getNodePaths(_token: IModelToken, _paths: NavNodeKeyPath[], _markedIndex: number, _options: object): Promise<NavNodePathElement[]> {
    return [];
  }

  public async getFilteredNodesPaths(_token: IModelToken, _filterText: string, _options: object): Promise<NavNodePathElement[]> {
    return [];
  }

  public async getDescriptor(token: IModelToken, displayType: string, keys: ECInstanceKeysList, options: object): Promise<content.Descriptor | null> {
    const params = this.createRequestParams("GetContentDescriptor", {
      displayType,
      keys,
      options,
    });
    return this.request(token, params, this.createContentDescriptor);
  }

  public async getContentSetSize(token: IModelToken, _descriptor: content.Descriptor, keys: ECInstanceKeysList, options: object): Promise<number> {
    const params = this.createRequestParams("GetContent", {
      keys,
      options,
    });
    return this.request(token, params, this.createContentDescriptor);
  }

  public async getContent(token: IModelToken, _descriptor: content.Descriptor, keys: ECInstanceKeysList, pageOptions: PageOptions, options: object): Promise<content.Content | null> {
    const params = this.createRequestParams("GetContent", {
      keys,
      pageOptions,
      options,
    });
    return this.request(token, params, this.createContentDescriptor);
  }

  public async getDistinctValues(_token: IModelToken, _displayType: string, _fieldName: string, _maximumValueCount: number, _options: object): Promise<string[]> {
    return [];
  }

  public async saveValueChange(_token: IModelToken, _instancesInfo: ChangedECInstanceInfo[], _propertyAccessor: string, _value: any, _options: object): Promise<ECInstanceChangeResult[]> {
    return [];
  }

  private request(token: IModelToken, _params: string, responseHandler?: (response: any) => any) {
    const imodel = IModelDb.find(token);
    if (!imodel || !imodel.nativeDb)
      throw new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, () => ({ iModelId: token.iModelId }));

    const serializedResponse = "{}"; // this._manager.handleRequest(imodel.nativeDb, params);
    const response = JSON.parse(serializedResponse);
    if (responseHandler)
      return responseHandler(response);
    return response;
  }

  private createRequestParams(requestId: string, requestParams: object): string {
    const request = {
      requestId,
      params: requestParams,
    };
    return JSON.stringify(request);
  }

  private createContentDescriptor(r: any): content.Descriptor {
    const selectClasses = new Array<content.SelectClassInfo>();
    for (const respClass of r.SelectClasses)
      selectClasses.push(this.createSelectClassInfo(respClass));

    const categories: { [name: string]: content.CategoryDescription } = {};
    const fields = new Array<content.Field>();
    for (const respField of r.Fields)
      fields.push(this.createField(respField, categories, null));

    let sortingField: content.Field | null = null;
    const sortingDirection = r.SortDirection as content.SortDirection;
    if (r.SortingFieldIndex > 0 && r.SortingFieldIndex < fields.length)
      sortingField = fields[r.SortingFieldIndex];

    const descriptor = new content.Descriptor(r.PreferredDisplayType, selectClasses, fields, r.ContentFlags);
    descriptor.sortingField = sortingField;
    descriptor.sortDirection = sortingDirection;
    descriptor.filterExpression = r.FilterExpression;
    return descriptor;
  }

  private createFieldType(r: any): content.TypeDescription {
    switch (r.ValueFormat) {
      case "Primitive":
        return new content.PrimitiveTypeDescription(r.TypeName);
      case "Array":
        return new content.ArrayTypeDescription(r.TypeName, this.createFieldType(r.MemberType));
      case "Struct":
        const structDescription = new content.StructTypeDescription(r.TypeName);
        for (const member of r.Members) {
          structDescription.Members.push({
            Name: member.Name,
            Label: member.Label,
            Type: this.createFieldType(member.Type),
          });
        }
        return structDescription;
    }
    assert(false, "Unknown value format");
    return new content.PrimitiveTypeDescription("string");
  }

  private createSelectClassInfo(r: any): content.SelectClassInfo {
    const classInfo = {
      id: r.SelectClassInfo.Id,
      name: r.SelectClassInfo.Name,
      displayLabel: r.SelectClassInfo.Label,
    };
    const info = new content.SelectClassInfo(classInfo, r.IsPolymorphic,
      this.createRelationshipPath(r.PathToPrimaryClass));
    for (const pr of r.RelatedPropertyPaths)
      info.relatedPropertyPaths.push(this.createRelationshipPath(pr));
    return info;
  }

  private createFieldEditor(_r: any): content.EditorDescription | null {
    return null;
    /* todo:
    if (!r)
      return null;
    const editor = new content.EditorDescription(r.Name);
    for (const paramsName in r.Params) {
      let unknownParams: any = r.Params[paramsName];
      switch (paramsName) {
        case EditorParamsTypes.Json:
          {
            editor.Params.MiscJsonParams = unknownParams;
            break;
          }
        case EditorParamsTypes.Multiline:
          {
            let params: IContentDescriptorFieldEditorMultilineParamsResponse = unknownParams;
            editor.Params.SupportsMultilineTex = { HeightInRows: params.HeightInRows };
            break;
          }
        case EditorParamsTypes.Range:
          {
            let params: IContentDescriptorFieldEditorRangeParamsResponse = unknownParams;
            editor.Params.SupportsRange = {
              Minimum: params.Minimum,
              Maximum: params.Maximum
            };
            break;
          }
        case EditorParamsTypes.Slider:
          {
            let params: IContentDescriptorFieldEditorSliderParamsResponse = unknownParams;
            editor.Params.SupportsSliderParams = {
              Minimum: params.Minimum,
              Maximum: params.Maximum,
              Intervals: (1 != params.IntervalsCount),
              NumButtons: params.IntervalsCount,
              ValueFactor: params.ValueFactor,
              Vertical: params.IsVertical
            };
            break;
          }
        default:
          {
            BeAssert(false, "Unrecognized field editor");
          }
      }
    }
    return editor;*/
  }

  private createCategory(r: any, categories: { [name: string]: content.CategoryDescription }): content.CategoryDescription {
    if (categories.hasOwnProperty(r.Name))
      return categories[r.Name];

    const category = new content.CategoryDescription(r.Name, r.DisplayLabel, r.Description, r.Priority, r.Expand);
    categories[category.name] = category;
    return category;
  }

  private createECPropertyInfo(r: any): content.ECPropertyInfo {
    const propertyInfo: content.ECPropertyInfo = {
      classInfo: {
        id: r.ActualClassInfo.Id,
        name: r.ActualClassInfo.Name,
        displayLabel: r.ActualClassInfo.Label,
      },
      name: r.Name,
      type: r.Type,
    };
    /* todo:
    if (r.Choices) {
      propertyInfo.Choices = r.Choices;
      propertyInfo.IsStrict = r.IsStrict;
    }*/
    /* todo:
    if (r.KindOfQuantity)
      propertyInfo.KindOfQuantity = CreateECKindOfQuantityInfo(r.KindOfQuantity);*/

    return propertyInfo;
  }

  private createRelatedClassInfo(r: any): content.RelatedClassInfo {
    return {
      sourceClassInfo: {
        id: r.SourceClassInfo.Id,
        name: r.SourceClassInfo.Name,
        displayLabel: r.SourceClassInfo.Label,
      },
      targetClassInfo: {
        id: r.TargetClassInfo.Id,
        name: r.TargetClassInfo.Name,
        displayLabel: r.TargetClassInfo.Label,
      },
      relationshipInfo: {
        id: r.RelationshipInfo.Id,
        name: r.RelationshipInfo.Name,
        displayLabel: r.RelationshipInfo.Label,
      },
      isForwardRelationship: r.IsForwardRelationship,
    };
  }

  private createRelationshipPath(r: any[]): content.RelationshipPathInfo {
    const path = new Array<content.RelatedClassInfo>();
    for (const pr of r)
      path.push(this.createRelatedClassInfo(pr));
    return path;
  }

  private createFieldProperty(r: any): content.Property {
    const propertyInfo = this.createECPropertyInfo(r.Property);
    const property = new content.Property(propertyInfo);
    for (const pr of r.RelatedClassPath)
      property.relatedClassPath.push(this.createRelatedClassInfo(pr));
    return property;
  }

  private createField(r: any, categories: { [name: string]: content.CategoryDescription }, parent: content.NestedContentField | null): content.Field {
    const type = this.createFieldType(r.Type);
    const editor = this.createFieldEditor(r.Editor);
    const category = this.createCategory(r.Category, categories);
    if (r.Properties) {
      // ecproperties-based field
      const field = new content.PropertiesField(category, r.Name, r.DisplayLabel, type,
        r.IsReadOnly, r.Priority, editor, parent);
      for (const pr of r.Properties)
        field.properties.push(this.createFieldProperty(pr));
      return field;
    }
    if (r.ContentClassInfo) {
      // nested content field
      assert(type.IsStructDescription, "Nested content fields' type should be 'struct'");
      const classInfo = {
        id: r.ContentClassInfo.Id,
        name: r.ContentClassInfo.Name,
        displayLabel: r.ContentClassInfo.Label,
      };
      const field = new content.NestedContentField(category, r.Name, r.DisplayLabel, type.asStructDescription()!,
        classInfo, this.createRelationshipPath(r.PathToPrimary), r.IsReadOnly, r.Priority, editor, parent);
      for (const nestedField of r.NestedFields)
        field.nestedFields.push(this.createField(nestedField, categories, field));
      return field;
    }
    // generic field (display label, calculated, etc.)
    return new content.Field(category, r.Name, r.DisplayLabel, type,
      r.IsReadOnly, r.Priority, editor, parent);
  }
}

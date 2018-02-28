/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "./Hierarchy";
import { SelectionInfo, Descriptor, Content } from "./content";
import { ChangedECInstanceInfo, ECInstanceChangeResult } from "./Changes";
import { InstanceKeysList } from "./EC";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";

/** Paging options. */
export interface PageOptions {
  pageStart: number;
  pageSize: number;
}

/** An abstract presentation manager which drives presentation controls. */
export interface ECPresentationManager {
  /** Retrieves root nodes.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] pageOptions  Page options for the requested nodes.
   * @param[in] options      An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either an array of @ref NavNode on success or an error string on error.
   */
  getRootNodes(token: IModelToken, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>>;

  /** Retrieves root nodes count.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] options  An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns the number of root nodes.
   */
  getRootNodesCount(token: IModelToken, options: object): Promise<number>;

  /** Retrieves children of the specified parent node.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] parent       The parent node.
   * @param[in] pageOptions  Page options for the requested nodes.
   * @param[in] options      An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either an array of @ref NavNode on success or an error string on error.
   */
  getChildren(token: IModelToken, parent: NavNode, pageOptions: PageOptions, options: object): Promise<Array<Readonly<NavNode>>>;

  /** Retrieves children count for the specified parent node.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] parent   The parent node.
   * @param[in] options  An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns the number of child nodes.
   */
  getChildrenCount(token: IModelToken, parent: NavNode, options: object): Promise<number>;

  /** Using the provided NavNodeKeyPaths, returns a merged node paths list.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] paths    An array of NavNodeKeyPaths, each defining the path from top to bottom.
   * @param[in] markedIndex Index of the path which will be marked in the resulting path's list.
   * @param[in] options  An options object that depends on the used presentation manager implementation.
   */
  getNodePaths(token: IModelToken, paths: NavNodeKeyPath[], markedIndex: number, options: object): Promise<Array<Readonly<NavNodePathElement>>>;

  /** Send message to get filtered nodes paths.
   * @param[in] token Token of imodel to pull data from
   * @param[in] filterText           Text to filter tree nodes by.
   * @param[in] options              An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either a boolean on success or an error string on error.
   */
  getFilteredNodesPaths(token: IModelToken, filterText: string, options: object): Promise<Array<Readonly<NavNodePathElement>>>;

  /** Retrieves the content descriptor which can be used to call @ref GetContent.
   * @param[in] token Token of imodel to pull data from.
   * @param[in] displayType  The preferred display type of the return content.
   * @param[in] keys         Keys of ECInstances to get the content for.
   * @param[in] selection    Optional selection info in case the content is being requested due to selection change.
   * @param[in] options  An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either a @ref Descriptor on success or an error string on error.
   */
  getContentDescriptor(token: IModelToken, displayType: string, keys: InstanceKeysList, selection: SelectionInfo | undefined, options: object): Promise<Readonly<Descriptor>>;

  /** Retrieves the content set size based on the supplied content descriptor override.
   * @param[in] token Token of imodel to pull data from
   * @param[in] descriptor           Content descriptor which specifies how the content should be returned.
   * @param[in] keys                 Keys of ECInstances to get the content for.
   * @param[in] options              An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either a number on success or an error string on error.
   * @note Even if concrete implementation returns content in pages, this function returns the total
   * number of records in the content set
   */
  getContentSetSize(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, options: object): Promise<number>;

  /** Retrieves the content based on the supplied content descriptor override.
   * @param[in] token Token of imodel to pull data from
   * @param[in] descriptor           Content descriptor which specifies how the content should be returned.
   * @param[in] keys                 Keys of ECInstances to get the content for.
   * @param[in] pageOptions          Paging options.
   * @param[in] options              An options object that depends on the used presentation manager implementation.
   * @return A promise object that returns either @ref Content on success or an error string on error.
   */
  getContent(token: IModelToken, descriptor: Descriptor, keys: InstanceKeysList, pageOptions: PageOptions, options: object): Promise<Readonly<Content>>;

  /** Send message to WorkThread to get specified column distinct values.
   * @param[in] token Token of imodel to pull data from
   * @param[in] displayType           Preferred display type.
   * @param[in] fieldName             Name of field to get distinct values for.
   * @param[in] maximumValueCount     Maximum amount of distinct values.
   * @param[in] options               An options object that depends on the used
   * presentation manager implementation.
   * @return A promise object that contains array of distinct values.
   */
  getDistinctValues(token: IModelToken, displayType: string, fieldName: string, maximumValueCount: number, options: object): Promise<string[]>;

  /** Send message to WorkThread to save changes from property editor.
   * @param[in] token Token of imodel to pull data from
   * @param[in] instancesInfo Info about the changed instances.
   * @param[in] propertyAccessor Name of the property that changed.
   * @param[in] value        The value to set.
   * @param[in] options      An options object that depends on the used presentation manager implementation.
   * @return A promise object that contains the new value.
   */
  saveValueChange(token: IModelToken, instancesInfo: ChangedECInstanceInfo[], propertyAccessor: string, value: any, options: object): Promise<Array<Readonly<ECInstanceChangeResult>>>;
}

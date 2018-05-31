/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as spies from "@helpers/Spies";
import * as faker from "faker";
import { SortDirection } from "@bentley/ui-core/lib";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationError, ValuesDictionary } from "@bentley/ecpresentation-common";
import * as content from "@bentley/ecpresentation-common/lib/content";
import { ECPresentationManager, ECPresentation } from "@bentley/ecpresentation-frontend";
import TableDataProvider from "@src/table/TableDataProvider";
import { CacheInvalidationProps } from "@src/common/ContentDataProvider";
import { createRandomDescriptor } from "@helpers/random/Content";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { PromiseContainer } from "@helpers/Promises";

/**
 * This is just a helper class to provide public access to
 * protected methods of TableDataProvider
 */
class Provider extends TableDataProvider {
  public invalidateCache(props: CacheInvalidationProps) { super.invalidateCache(props); }
  public configureContentDescriptor(descriptor: content.Descriptor) { return super.configureContentDescriptor(descriptor); }
}

interface MemoizedCacheSpies {
  getColumns: any;
}

describe("TableDataProvider", () => {

  let imodelToken: IModelToken;
  let rulesetId: string;
  let provider: Provider;
  let memoizedCacheSpies: MemoizedCacheSpies;
  const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    imodelToken = new IModelToken();
    rulesetId = faker.random.word();
    imodelMock.setup((x) => x.iModelToken).returns(() => imodelToken);
    ECPresentation.presentation = presentationManagerMock.object;
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new Provider(imodelMock.object, rulesetId);
    resetMemoizedCacheSpies();
  });

  const resetMemoizedCacheSpies = () => {
    spies.restore();
    memoizedCacheSpies = {
      getColumns: spies.spy.on(provider.getColumns.cache, "clear"),
    };
  };

  const createEmptyContentItem = (): content.Item => {
    return new content.Item([createRandomECInstanceKey()], faker.random.words(),
      "", undefined, {}, {}, []);
  };
  const createContent = (recordsCount: number, itemsGenerator: () => content.Item = createEmptyContentItem): content.Content => {
    const descriptor = createRandomDescriptor();
    const records = new Array<content.Item>();
    while (recordsCount--) {
      records.push(itemsGenerator());
    }
    return {
      descriptor,
      contentSet: records,
    };
  };
  const createSingleRecordContent = (itemsGenerator?: () => content.Item) => createContent(1, itemsGenerator);

  describe("constructor", () => {

    it("sets display type to GRID", () => {
      expect(provider.displayType).to.eq(content.DefaultContentDisplayTypes.GRID);
    });

    it("sets default sorting properties", () => {
      expect(provider.sortColumnKey).to.be.undefined;
      expect(provider.sortDirection).to.eq(SortDirection.NoSort);
    });

  });

  describe("invalidateCache", () => {

    it("resets filtering, sorting and memoized columns when 'descriptor' flag is set", () => {
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor());
      provider.filterExpression = faker.random.words();
      provider.sort(0, SortDirection.Descending);
      resetMemoizedCacheSpies();
      provider.invalidateCache({ descriptor: true });
      expect(memoizedCacheSpies.getColumns).to.be.called();
    });

    it("resets memoized columns when 'descriptorConfiguration' flag is set", () => {
      provider.invalidateCache({ descriptorConfiguration: true });
      expect(memoizedCacheSpies.getColumns).to.be.called();
    });

    it("resets cached pages when 'size' flag is set", async () => {
      const getContentMock = moq.Mock.ofInstance((provider as any).getContent);
      getContentMock.setup((x) => x(moq.It.isAny())).returns(async () => createSingleRecordContent());
      (provider as any).getContent = getContentMock.object;

      expect(await provider.getRow(0)).to.not.be.undefined;
      expect(provider.getLoadedRow(0)).to.not.be.undefined;

      provider.invalidateCache({ size: true });
      expect(provider.getLoadedRow(0)).to.be.undefined;
    });

    it("resets cached pages when 'content' flag is set", async () => {
      const getContentMock = moq.Mock.ofInstance((provider as any).getContent);
      getContentMock.setup((x) => x(moq.It.isAny())).returns(async () => createSingleRecordContent());
      getContentMock.object.cache = { clear: () => { } };
      (provider as any).getContent = getContentMock.object;

      expect(await provider.getRow(0)).to.not.be.undefined;
      expect(provider.getLoadedRow(0)).to.not.be.undefined;

      provider.invalidateCache({ content: true });
      expect(provider.getLoadedRow(0)).to.be.undefined;
    });

  });

  describe("configureContentDescriptor", () => {

    it("sets sorting properties", async () => {
      const source = createRandomDescriptor();
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);

      await provider.sort(0, SortDirection.Descending);
      let result = provider.configureContentDescriptor(source);
      expect(source.sortingField).to.be.undefined;
      expect(source.sortDirection).to.be.undefined;
      expect(result.sortingField!.name).to.eq((await provider.getColumns())[0].key);
      expect(result.sortDirection).to.eq(content.SortDirection.Descending);

      await provider.sort(0, SortDirection.Ascending);
      result = provider.configureContentDescriptor(source);
      expect(source.sortingField).to.be.undefined;
      expect(source.sortDirection).to.be.undefined;
      expect(result.sortingField!.name).to.eq((await provider.getColumns())[0].key);
      expect(result.sortDirection).to.eq(content.SortDirection.Ascending);

      await provider.sort(0, SortDirection.NoSort);
      result = provider.configureContentDescriptor(source);
      expect(source.sortingField).to.be.undefined;
      expect(source.sortDirection).to.be.undefined;
      expect(result.sortingField!.name).to.eq((await provider.getColumns())[0].key);
      expect(result.sortDirection).to.be.undefined;
    });

    it("sets filterExpression", () => {
      const source = createRandomDescriptor();
      provider.filterExpression = "test";
      const result = provider.configureContentDescriptor(source);
      expect(source.filterExpression).to.be.undefined;
      expect(result.filterExpression).to.eq("test");
    });

  });

  describe("filterExpression", () => {

    it("sets a different filterExpression and clears caches", () => {
      provider.filterExpression = "test 1";
      expect(provider.filterExpression).to.eq("test 1");
      resetMemoizedCacheSpies();

      provider.filterExpression = "test 2";
      expect(provider.filterExpression).to.eq("test 2");
      expect(memoizedCacheSpies.getColumns).to.be.called();
    });

    it("doesn't clear caches if setting to the same filterExpression", () => {
      provider.filterExpression = "test";
      expect(provider.filterExpression).to.eq("test");
      resetMemoizedCacheSpies();

      provider.filterExpression = "test";
      expect(provider.filterExpression).to.eq("test");
      expect(memoizedCacheSpies.getColumns).to.not.be.called();
    });

  });

  describe("sort", () => {

    it("throws when trying to sort by invalid column", async () => {
      const source = createRandomDescriptor();
      source.fields = [];
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);
      await expect(provider.sort(0, SortDirection.NoSort)).to.eventually.be.rejectedWith(ECPresentationError);
    });

    it("invalidates descriptor configuration and content", async () => {
      const source = createRandomDescriptor();
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);
      const invalidateCacheMock = moq.Mock.ofInstance(provider.invalidateCache);
      provider.invalidateCache = invalidateCacheMock.object;
      await provider.sort(0, SortDirection.NoSort);
      invalidateCacheMock.verify((x) => x({ descriptorConfiguration: true, content: true }), moq.Times.once());
    });

    it("sets sorting properties", async () => {
      const source = createRandomDescriptor();
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);
      await provider.sort(0, SortDirection.Descending);
      expect(provider.sortColumnKey).to.eq((await provider.getColumns())[0].key);
      expect(provider.sortDirection).to.eq(SortDirection.Descending);
    });

  });

  describe("sortColumn", () => {

    it("returns undefined when no sorting column is set", async () => {
      expect(await provider.sortColumn).to.be.undefined;
    });

    /*it("throws when sorting column key is invalid", async () => {
      const source = createRandomDescriptor();
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);
      await provider.sort(0, SortDirection.Ascending);
      provider.getColumns.cache.clear();
      (provider as any).getDefaultContentDescriptor.cache.clear();
      (provider as any).getContentDescriptor.cache.clear();
      source.fields.splice(0, 1);
      await expect(provider.sortColumn).to.eventually.be.rejectedWith("Assert");
    });*/

    it("returns valid sorting column", async () => {
      const source = createRandomDescriptor();
      presentationManagerMock.setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => source);
      await provider.sort(0, SortDirection.Descending);
      const sortingColumn = await provider.sortColumn;
      expect(sortingColumn).to.eq((await provider.getColumns())[0]);
    });

  });

  describe("getColumns", () => {

    it("returns valid column descriptions", async () => {
      const descriptor = createRandomDescriptor();
      (provider as any).getContentDescriptor = () => descriptor;
      const cols = await provider.getColumns();
      expect(cols).to.matchSnapshot();
    });

    it("returns empty list when descriptor is undefined", async () => {
      (provider as any).getContentDescriptor = () => undefined;
      const cols = await provider.getColumns();
      expect(cols).to.deep.eq([]);
    });

    it("memoizes result", async () => {
      const descriptor = createRandomDescriptor();
      const resultPromiseContainer = new PromiseContainer<content.Descriptor>();
      const getContentDescriptorMock = moq.Mock.ofInstance(() => (provider as any).getContentDescriptor);
      getContentDescriptorMock.setup((x) => x()).returns(() => resultPromiseContainer.promise).verifiable(moq.Times.once());
      getContentDescriptorMock.setup((x) => x()).verifiable(moq.Times.never());
      (provider as any).getContentDescriptor = getContentDescriptorMock.object;

      const requests = [1, 2].map(() => provider.getColumns());
      resultPromiseContainer.resolve(descriptor);
      const response = await Promise.all(requests);
      expect(response[0]).to.deep.eq(response[1], "both responses should be equal");
      presentationManagerMock.verifyAll();
    });

  });

  describe("getRowsCount", () => {

    it("returns count from base class", async () => {
      const size = faker.random.number();
      (provider as any).getContentSetSize = () => size;
      const count = await provider.getRowsCount();
      expect(count).to.eq(size);
    });

  });

  describe("getRow", () => {

    it("returns undefined when content is undefined", async () => {
      (provider as any).getContent = async () => undefined;
      const row = await provider.getRow(0);
      expect(row).to.be.undefined;
    });

    it("returns undefined when content contains no records", async () => {
      (provider as any).getContent = async () => createContent(0);
      const row = await provider.getRow(0);
      expect(row).to.be.undefined;
    });

    it("throws when content record is invalid - contains invalid number of primary keys", async () => {
      const record = createEmptyContentItem();
      record.primaryKeys = [];
      (provider as any).getContent = async (): Promise<content.Content> => ({
        descriptor: createRandomDescriptor(),
        contentSet: [record],
      });
      await expect(provider.getRow(0)).to.eventually.be.rejectedWith(ECPresentationError);
    });

    it("requests content in pages", async () => {
      provider = new Provider(imodelMock.object, rulesetId, 2, 10);
      const contentResolver = [0, 1].map(() => new PromiseContainer<content.Content>());

      const getContentMock = moq.Mock.ofInstance((provider as any).getContent);
      (provider as any).getContent = getContentMock.object;
      getContentMock.setup((x) => x({ pageStart: 0, pageSize: 2 })).returns(() => contentResolver[0].promise).verifiable(moq.Times.once());
      getContentMock.setup((x) => x({ pageStart: 2, pageSize: 2 })).returns(() => contentResolver[1].promise).verifiable(moq.Times.once());

      // request rows without await to make sure paging is handled properly (new
      // pages are not created while other pages for the same position are being loaded)
      const requests = [0, 1, 2].map((index) => provider.getRow(index));
      contentResolver.forEach((resolver) => resolver.resolve(createContent(2)));
      const rows = await Promise.all(requests);
      rows.forEach((row) => expect(row).to.not.be.undefined);

      // verify the last row in second page is also loaded (even though we didn't request it)
      expect(provider.getLoadedRow(3)).to.not.be.undefined;

      // verify getContent was called once per page
      getContentMock.verifyAll();
    });

    it("returns valid row item", async () => {
      const descriptor = createRandomDescriptor();
      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      descriptor.fields.forEach((field) => {
        values[field.name] = faker.random.word();
        displayValues[field.name] = faker.random.words();
      });
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;
      const row = await provider.getRow(0);
      expect(row).to.matchSnapshot();
    });

  });

});

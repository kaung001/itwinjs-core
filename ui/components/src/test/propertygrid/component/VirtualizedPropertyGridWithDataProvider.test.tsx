/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { act, fireEvent, render, waitForDomChange } from "@testing-library/react";
import * as faker from "faker";
import * as React from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import {
  IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent,
} from "../../../ui-components/propertygrid/PropertyDataProvider";
import { ResolvablePromise } from "../../test-helpers/misc";
import TestUtils from "../../TestUtils";
import { VirtualizedPropertyGridWithDataProvider } from "../../../ui-components/propertygrid/component/VirtualizedPropertyGridWithDataProvider";

describe("VirtualizedPropertyGridWithDataProvider", () => {

  const categories: PropertyCategory[] = [
    { name: "Group_1", label: "Group 1", expand: true },
    { name: "Group_2", label: "Group 2", expand: false },
  ];
  const records: PropertyRecord[] = [
    TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
    TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
  ];
  let dataProvider: IPropertyDataProvider;

  before(async () => {
    await TestUtils.initializeUiComponents();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 1200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 500);
  });

  after(() => {
    TestUtils.terminateUiComponents();
    sinon.restore();
  });

  beforeEach(() => {
    const evt = new PropertyDataChangeEvent();
    dataProvider = {
      onDataChanged: evt,
      getData: async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories,
        records: {
          Group_1: [records[0]],
          Group_2: [records[1]],
        },
      }),
    };
  });

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("rendering", () => {
    it("renders correctly horizontally", async () => {
      const { container } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} isOrientationFixed={true} />);

      await TestUtils.flushAsyncOperations();

      expect(container.querySelector(".components-property-record--horizontal")).to.be.not.null;
    });

    it("renders correctly vertically", async () => {
      const { container } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Vertical} dataProvider={dataProvider} isOrientationFixed={true} />);

      await TestUtils.flushAsyncOperations();

      expect(container.querySelector(".components-property-record--vertical")).to.be.not.null;
    });

    it("renders PropertyCategoryBlocks correctly", async () => {
      const { container } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      const categoryBlocks = container.querySelectorAll(".virtualized-grid-node-category");
      expect(categoryBlocks.length, "Wrong amount of categories").to.be.equal(2);

      expect(categoryBlocks[0].textContent).to.be.equal("Group 1");
      expect(categoryBlocks[1].textContent).to.be.equal("Group 2");
    });

    it("renders nested property categories", async () => {
      const parentCategory: PropertyCategory = {
        name: "ParentCategory",
        label: "Parent",
        expand: true,
      };
      const childCategory: PropertyCategory = {
        name: "ChildCategory",
        label: "Child",
        expand: true,
        parentCategory,
      };
      parentCategory.childCategories = [childCategory];
      dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [parentCategory],
          records: {
            [childCategory.name]: [TestUtils.createPrimitiveStringProperty("test", "Test", "Test")],
          },
        }),
      };

      const { container } = render(<VirtualizedPropertyGridWithDataProvider dataProvider={dataProvider} />);
      await TestUtils.flushAsyncOperations();

      const categoryBlocks = container.querySelectorAll(".virtualized-grid-node-category");
      expect(categoryBlocks.length, "Wrong amount of categories").to.be.equal(2);
    });

    it("if property record has links property set and onClick is not set, sets onClick property, otherwise not", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testRecord = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      testRecord.links = {
        matcher: testMatcher,
      };
      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testRecord],
          Group_2: [records[0]],
        },
      });

      render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      expect(testRecord.links.matcher).to.be.equal(testMatcher);
      expect(testRecord.links.onClick).to.be.not.undefined;
      expect(records[0].links).to.be.undefined;
    });

    it("sets default onPropertyLinkClick event handler to records with link property if not passed with props", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testNestedRecord1 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testNestedRecord2 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testStructRecord = TestUtils.createStructProperty("testStructRecord", { testProperty: testNestedRecord2 });
      const testArrayRecord = TestUtils.createArrayProperty("testArrayRecord", [testNestedRecord1, testStructRecord]);
      testNestedRecord1.links = {
        matcher: testMatcher,
      };
      testNestedRecord2.links = {
        matcher: testMatcher,
      };
      testArrayRecord.links = {
        matcher: testMatcher,
      };

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testArrayRecord],
          Group_2: [records[0]],
        },
      });

      render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      expect(testArrayRecord.links.onClick).to.be.not.undefined;
      expect(testNestedRecord1.links.onClick).to.be.not.undefined;
      expect(testNestedRecord2.links.onClick).to.be.not.undefined;
    });

    it("sets passed onPropertyLinkClick event handler to records with link property", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testNestedRecord1 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testNestedRecord2 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testStructRecord = TestUtils.createStructProperty("testStructRecord", { testProperty: testNestedRecord2 });
      const testArrayRecord = TestUtils.createArrayProperty("testArrayRecord", [testNestedRecord1, testStructRecord]);
      testNestedRecord1.links = {
        matcher: testMatcher,
      };
      testNestedRecord2.links = {
        matcher: testMatcher,
      };
      testStructRecord.links = {
        matcher: testMatcher,
      };

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testArrayRecord],
          Group_2: [records[0]],
        },
      });
      const propertyLinkClickFn = () => { };
      render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} onPropertyLinkClick={propertyLinkClickFn} />);

      await TestUtils.flushAsyncOperations();

      expect(testNestedRecord1.links.onClick).to.be.equal(propertyLinkClickFn);
      expect(testStructRecord.links.onClick).to.be.equal(propertyLinkClickFn);
      expect(testNestedRecord2.links.onClick).to.be.equal(propertyLinkClickFn);
    });

    describe("default onPropertyLinkClick behavior", () => {
      const locationMockRef: moq.IMock<Location> = moq.Mock.ofInstance(location);
      let testRecord: PropertyRecord;
      let spy: sinon.SinonStub<[(string | undefined)?, (string | undefined)?, (string | undefined)?, (boolean | undefined)?], Window | null>;

      before(() => {
        location = locationMockRef.object;
      });

      after(() => {
        locationMockRef.reset();
      });

      beforeEach(() => {
        const testMatcher = (_displayValue: string) => [];
        testRecord = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
        testRecord.links = {
          matcher: testMatcher,
        };
        dataProvider.getData = async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [...categories],
          records: {
            Group_1: [testRecord],
            Group_2: [records[0]],
          },
        });

        render(<VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider} />);
      });

      afterEach(() => {
        spy.restore();
      });

      it("opens new window if the link text was found in record with no schema specified", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link www.testLink.com"), "www.testLink.com");
        expect(spy).to.be.calledOnceWith("http://www.testLink.com", "_blank");
      });

      it("opens new window if the link text was found in record with http schema", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link http://www.testLink.com"), "http://www.testLink.com");
        expect(spy).to.be.calledOnceWith("http://www.testLink.com", "_blank");
      });

      it("opens new window if the link text was found in record with https schema", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link https://www.testLink.com"), "https://www.testLink.com");
        expect(spy).to.be.calledOnceWith("https://www.testLink.com", "_blank");
      });

      it("does not open new window if there were no url links", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with someLink@mail.com otherLink@mail.com"), "not an url link");
        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with someLink@mail.com otherLink@mail.com"), "testEmail@mail.com");
        sinon.assert.notCalled(spy);
      });

      it("sets location href value to value got in the text if it is an email link", async () => {
        await TestUtils.flushAsyncOperations();

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with testLink.com someLink@mail.com otherLink@mail.com"), "someOtherLink@mail.com");
        expect(locationMockRef.object.href).to.be.equal("mailto:someOtherLink@mail.com");
      });

      it("sets location href value to value got in the text if it is an ProjectWise Explorer link", async () => {
        await TestUtils.flushAsyncOperations();

        // cSpell:disable
        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "pw://server.bentley.com:datasource-01/Documents/ProjectName"), "pw://server.bentley.com:datasource-01/Documents/ProjectName");
        expect(locationMockRef.object.href).to.be.equal("pw://server.bentley.com:datasource-01/Documents/ProjectName");
        // cSpell:enable
      });
    });

    it("renders PropertyCategoryBlock as collapsed when it gets clicked", async () => {
      const { container } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      let categoryChild = container.querySelector(".virtualized-grid-node span[title=\"CADID1\"]");
      expect(categoryChild, "Category child is not rendered").to.not.be.null;

      const categoryBlocks = container.querySelectorAll(".virtualized-grid-node-category .header");
      expect(categoryBlocks.length, "Wrong amount of categories").to.be.equal(2);
      const categoryBlock = categoryBlocks[0];

      fireEvent.click(categoryBlock);

      categoryChild = container.querySelector(".virtualized-grid-node span[title=\"CADID1\"]");
      expect(categoryChild, "Category child rendered").to.be.null;
    });

    it("keeps the collapsed state of PropertyCategoryBlock when non-nested data is refreshed", async () => {
      const rootCategory1: PropertyCategory = {
        name: "RootCategory1",
        label: "Root1",
        expand: true,
      };
      const childCategory1: PropertyCategory = {
        name: "ChildCategory1",
        label: "Child",
        expand: true,
        parentCategory: rootCategory1,
      };
      rootCategory1.childCategories = [childCategory1];
      const rootCategory2: PropertyCategory = {
        name: "RootCategory2",
        label: "Root2",
        expand: false,
      };
      const childCategory2: PropertyCategory = {
        name: "ChildCategory2",
        label: "Child",
        expand: true,
        parentCategory: rootCategory2,
      };
      rootCategory2.childCategories = [childCategory2];
      dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [rootCategory1, rootCategory2],
          records: {
            [rootCategory1.name]: [TestUtils.createPrimitiveStringProperty("rootCategory1Property", "Test", "Test")],
            [childCategory1.name]: [TestUtils.createPrimitiveStringProperty("childCategory1Property", "Test", "Test")],
            [rootCategory2.name]: [TestUtils.createPrimitiveStringProperty("rootCategory2Property", "Test", "Test")],
            [childCategory2.name]: [TestUtils.createPrimitiveStringProperty("childCategory2Property", "Test", "Test")],
          },
          reusePropertyDataState: true,
        }),
      };

      const { findByText, getByText, queryByText } = render(
        <VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />,
      );

      await findByText("Root1");

      expect(getByText("rootCategory1Property")).to.be.not.null;
      expect(getByText("childCategory1Property")).to.be.not.null;
      expect(queryByText("rootCategory2Property")).to.be.null;
      expect(queryByText("childCategory2Property")).to.be.null;

      fireEvent.click(getByText("Root1"));
      fireEvent.click(getByText("Root2"));

      expect(queryByText("rootCategory1Property")).to.be.null;
      expect(queryByText("childCategory1Property")).to.be.null;
      expect(getByText("rootCategory2Property")).to.be.not.null;
      expect(getByText("childCategory2Property")).to.be.not.null;

      // Refresh PropertyGrid data.
      act(() => dataProvider.onDataChanged.raiseEvent());
      await waitForDomChange();

      expect(queryByText("rootCategory1Property")).to.be.null;
      expect(queryByText("childCategory1Property")).to.be.null;
      expect(getByText("rootCategory2Property")).to.be.not.null;
      expect(getByText("childCategory2Property")).to.be.not.null;
    });

    it("keeps the collapsed state of PropertyCategoryBlock when nested data is refreshed", async () => {
      const rootCategory1: PropertyCategory = {
        name: "RootCategory1",
        label: "Root1",
        expand: true,
      };
      const childCategory1: PropertyCategory = {
        name: "ChildCategory1",
        label: "Child1",
        expand: false,
        parentCategory: rootCategory1,
      };
      rootCategory1.childCategories = [childCategory1];
      const rootCategory2: PropertyCategory = {
        name: "RootCategory2",
        label: "Root2",
        expand: true,
      };
      const childCategory2: PropertyCategory = {
        name: "ChildCategory2",
        label: "Child2",
        expand: true,
        parentCategory: rootCategory2,
      };
      rootCategory2.childCategories = [childCategory2];
      dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [rootCategory1, rootCategory2],
          records: {
            [rootCategory1.name]: [TestUtils.createPrimitiveStringProperty("rootCategory1Property", "Test", "Test")],
            [childCategory1.name]: [TestUtils.createPrimitiveStringProperty("childCategory1Property", "Test", "Test")],
            [rootCategory2.name]: [TestUtils.createPrimitiveStringProperty("rootCategory2Property", "Test", "Test")],
            [childCategory2.name]: [TestUtils.createPrimitiveStringProperty("childCategory2Property", "Test", "Test")],
          },
          reusePropertyDataState: true,
        }),
      };

      const { findByText, getByText, queryByText } = render(
        <VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />,
      );

      await findByText("Root1");

      expect(queryByText("childCategory1Property")).to.be.null;
      expect(getByText("childCategory2Property")).to.be.not.null;

      fireEvent.click(getByText("Child1"));
      fireEvent.click(getByText("Child2"));

      expect(getByText("childCategory1Property")).to.be.not.null;
      expect(queryByText("childCategory2Property")).to.be.null;

      // Refresh PropertyGrid data.
      act(() => dataProvider.onDataChanged.raiseEvent());
      await waitForDomChange();

      expect(getByText("childCategory1Property")).to.be.not.null;
      expect(queryByText("childCategory2Property")).to.be.null;
    });

    it("rerenders if data in the provider changes", async () => {
      const { container } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories: [...categories, { name: "Group_3", label: "Group 3", expand: false }],
        records: {
          Group_1: [records[0]],
          Group_2: [records[1]],
          Group_3: [],
        },
      });
      dataProvider.onDataChanged.raiseEvent();

      await TestUtils.flushAsyncOperations();

      const categoryBlocks = container.querySelectorAll(".virtualized-grid-node-category");
      expect(categoryBlocks.length).to.be.eq(3);
    });

    it("doesn't rerender on intermediate data changes", async () => {
      const data: PropertyData = {
        label: PropertyRecord.fromString(faker.random.word()),
        categories: [{ label: faker.random.word(), name: "test", expand: true }],
        records: {
          test: [
            new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, displayValue: faker.random.word() },
              { typename: faker.database.type(), name: faker.random.word(), displayLabel: faker.random.word() }),
          ],
        },
      };
      const dataPromise = new ResolvablePromise<PropertyData>();
      const dataFake = sinon.fake.returns(dataPromise);
      dataProvider.getData = dataFake;

      // first render
      render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={dataProvider} />);
      await TestUtils.flushAsyncOperations();

      expect(dataFake).to.be.calledOnce;

      // simulate multiple onDataChanged calls
      for (let i = 1; i <= 10; ++i)
        dataProvider.onDataChanged.raiseEvent();

      // resolve the data promise
      await dataPromise.resolve(data);

      // expect data to be requested two more times.
      // Since the first request is already resolved, it should call once for initial change and once for the last change,
      // but not for intermediate ones
      await TestUtils.flushAsyncOperations();
      expect(dataFake).to.be.calledThrice;
    });

    it("changes orientation when props change", async () => {
      const { container, rerender } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();

      expect(container.querySelector(".components-property-record--horizontal")).to.be.not.null;

      rerender(<VirtualizedPropertyGridWithDataProvider
        orientation={Orientation.Vertical}
        dataProvider={dataProvider}
        isOrientationFixed={true}
      />);

      expect(container.querySelector(".components-property-record--vertical")).to.be.not.null;
    });
  });

  describe("property selection", () => {
    it("calls onPropertySelectionChanged when property gets clicked and selection is enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      expect(onPropertySelectionChanged.called).to.be.false;

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      const clickableComponent = clickableComponents[0];
      fireEvent.click(clickableComponent);

      expect(onPropertySelectionChanged.called).to.be.true;
    });

    it("deselects if clicked a 2nd time", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      expect(container.querySelectorAll(".components--selected").length).to.be.equal(0);

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);
      const clickableComponent = clickableComponents[0];
      fireEvent.click(clickableComponent);

      expect(container.querySelectorAll(".components--selected").length).to.be.equal(1);

      fireEvent.click(clickableComponent);

      expect(container.querySelectorAll(".components--selected").length).to.be.equal(0);
    });

    it("does not call onPropertySelectionChanged when property gets clicked and selection is disabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={false}
          onPropertySelectionChanged={onPropertySelectionChanged}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();

      const renderedRecords = container.querySelectorAll(".components-property-record--horizontal");
      expect(renderedRecords.length).to.be.greaterThan(0);

      fireEvent.click(renderedRecords[0]);

      expect(onPropertySelectionChanged.called).to.be.false;
    });

    it("calls onPropertySelectionChanged when property gets right clicked and right click selection is enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      fireEvent.contextMenu(clickableComponents[0]);

      expect(onPropertySelectionChanged.called).to.be.true;
    });

    it("calls onPropertySelectionChanged once when property gets right clicked after left clicked and both left and right click selections are enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionOnRightClickEnabled={true}
          isPropertySelectionEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      const clickableComponent = clickableComponents[0];

      fireEvent.click(clickableComponent);
      fireEvent.contextMenu(clickableComponent);

      expect(onPropertySelectionChanged.callCount).to.be.equal(2);
    });

    it("does not deselect if right clicked a 2nd time", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);
      const clickableComponent = clickableComponents[0];

      fireEvent.contextMenu(clickableComponent);
      expect(container.querySelectorAll(".components--selected").length).to.eq(1);

      fireEvent.contextMenu(clickableComponent);
      expect(container.querySelectorAll(".components--selected").length).to.eq(1);
    });

    it("deselects if left clicked after right clicked", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);
      const clickableComponent = clickableComponents[0];

      fireEvent.contextMenu(clickableComponent);
      expect(container.querySelectorAll(".components--selected").length).to.eq(1);

      fireEvent.click(clickableComponent);
      expect(container.querySelectorAll(".components--selected").length).to.eq(0);
    });

    it("does not call onPropertySelectionChanged when property gets right clicked and selection is disabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={false}
          onPropertySelectionChanged={onPropertySelectionChanged}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      fireEvent.contextMenu(clickableComponents[0]);

      expect(onPropertySelectionChanged.called).to.be.false;
    });
  });

  describe("property editing", () => {
    it("starts editor on click & commits on Enter", async () => {
      const spyMethod = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertyEditingEnabled={true}
          onPropertyUpdated={spyMethod}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      fireEvent.click(clickableComponents[0]);

      const cellEditors = container.querySelectorAll("input.components-cell-editor");
      expect(cellEditors.length).to.be.equal(1);

      fireEvent.keyDown(cellEditors[0], { key: "Enter" });

      await TestUtils.flushAsyncOperations();

      expect(spyMethod).to.be.calledOnce;
    });

    it("does not start editor on click if not selected yet", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}   // when this is true, user must click once to select then again to edit
          isPropertyEditingEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);

      fireEvent.click(clickableComponents[0]);

      expect(container.querySelectorAll(".components-cell-editor").length).to.be.equal(0);
    });
    it("starts editor on click if clicked before to select", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}   // when this is true, user must click once to select then again to edit
          isPropertyEditingEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components--clickable");
      expect(clickableComponents.length).to.be.greaterThan(0);
      fireEvent.click(clickableComponents[0]);

      expect(container.querySelectorAll(".components--selected").length).to.be.equal(1);

      fireEvent.click(clickableComponents[0]);

      const cellEditors = container.querySelectorAll("input.components-cell-editor");
      expect(cellEditors.length).to.be.equal(1);

      const inputNode = cellEditors[0];
      fireEvent.keyDown(inputNode, { key: "Escape" });

      await TestUtils.flushAsyncOperations();

      expect(container.querySelectorAll(".components-cell-editor").length, "Cell editor did not disappear after pressing Escape").to.eq(0);
    });
  });

  describe("context menu", () => {
    it("calls onPropertyContextMenu callback when right clicked on a property", async () => {
      const callback = sinon.spy();
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          onPropertyContextMenu={callback}
          isOrientationFixed={true}
        />);
      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".components-property-record--horizontal");
      expect(clickableComponents.length).to.be.greaterThan(0);
      fireEvent.contextMenu(clickableComponents[0]);

      expect(callback).to.be.calledOnce;
      expect(callback.firstCall.args[0].propertyRecord).to.deep.eq(records[0]);
    });
  });

  describe("Nested border tests", () => {
    it("Wraps simple content in nested borders correctly", async () => {
      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isOrientationFixed={true}
        />);
      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".virtualized-grid-node");
      expect(clickableComponents.length).to.be.equal(3);

      expect(clickableComponents[0].querySelector(".virtualized-grid-node > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[1].querySelector(".virtualized-grid-node > .nested-border-middle.nested-border-bottom > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[2].querySelector(".virtualized-grid-node > .virtualized-grid-node-content")).to.be.not.null;
    });

    it("Wraps nested content in nested borders correctly", async () => {
      const parentCategory: PropertyCategory = {
        name: "ParentCategory",
        label: "Parent",
        expand: true,
      };
      const childCategory1: PropertyCategory = {
        name: "ChildCategory1",
        label: "Child",
        expand: true,
        parentCategory,
      };
      const childCategory2: PropertyCategory = {
        name: "ChildCategory2",
        label: "Child",
        expand: true,
        parentCategory,
      };
      parentCategory.childCategories = [childCategory1, childCategory2];
      dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [parentCategory],
          records: {
            [parentCategory.name]: [
              TestUtils.createArrayProperty("testArray", [
                TestUtils.createPrimitiveStringProperty("test1", "Test", "Test"),
                TestUtils.createPrimitiveStringProperty("test2", "Test", "Test"),
                TestUtils.createPrimitiveStringProperty("test3", "Test", "Test"),
              ], true),
            ],
            [childCategory1.name]: [
              TestUtils.createPrimitiveStringProperty("test4", "Test", "Test"),
              TestUtils.createStructProperty("testStruct", {
                test5: TestUtils.createPrimitiveStringProperty("test5", "Test", "Test"),
                test6: TestUtils.createPrimitiveStringProperty("test6", "Test", "Test"),
                test7: TestUtils.createPrimitiveStringProperty("test7", "Test", "Test"),
              }, true),
            ],
            [childCategory2.name]: [],
          },
        }),
      };

      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isOrientationFixed={true}
        />);
      await TestUtils.flushAsyncOperations();

      const clickableComponents = container.querySelectorAll(".virtualized-grid-node");
      expect(clickableComponents.length).to.be.equal(12);

      expect(clickableComponents[0].querySelector(".virtualized-grid-node > .virtualized-grid-node-category")).to.be.not.null;
      expect(clickableComponents[1].querySelector(".virtualized-grid-node > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[2].querySelector(".virtualized-grid-node > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[3].querySelector(".virtualized-grid-node > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[4].querySelector(".virtualized-grid-node > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;

      expect(clickableComponents[5].querySelector(".virtualized-grid-node > .nested-border-middle > .virtualized-grid-node-category")).to.be.not.null;
      expect(clickableComponents[6].querySelector(".virtualized-grid-node > .nested-border-middle > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[7].querySelector(".virtualized-grid-node > .nested-border-middle > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[8].querySelector(".virtualized-grid-node > .nested-border-middle > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[9].querySelector(".virtualized-grid-node > .nested-border-middle > .nested-border-middle > .virtualized-grid-node-content")).to.be.not.null;
      expect(clickableComponents[10].querySelector(".virtualized-grid-node > .nested-border-middle > .nested-border-middle.nested-border-bottom > .virtualized-grid-node-content")).to.be.not.null;

      expect(clickableComponents[11].querySelector(".virtualized-grid-node > .nested-border-middle.nested-border-bottom > .virtualized-grid-node-category")).to.be.not.null;
    });
  });

  describe("Should virtualize property rendering", () => {
    it("Should render less than provided data, when provided 1000 records", async () => {
      const parentCategory: PropertyCategory = {
        name: "ParentCategory",
        label: "Parent",
        expand: true,
      };
      dataProvider = {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString(faker.random.word()),
          description: faker.random.words(),
          categories: [parentCategory],
          records: {
            [parentCategory.name]: Array.from({ length: 1000 }).map((_, index) => TestUtils.createPrimitiveStringProperty(`test${index}`, "Test", "Test")),
          },
        }),
      };

      const { container } = render(
        <VirtualizedPropertyGridWithDataProvider
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isOrientationFixed={true}
        />);
      await TestUtils.flushAsyncOperations();

      const gridNodes = container.querySelectorAll(".virtualized-grid-node");
      expect(gridNodes.length).to.be.greaterThan(0);
      expect(gridNodes.length).to.be.lessThan(1000);
    });
  });

  it("handles onDataChanged event subscriptions when mounting, changing props and unmounting", () => {
    const evt1 = new PropertyDataChangeEvent();
    const providerMock1 = moq.Mock.ofType<IPropertyDataProvider>();
    providerMock1.setup(async (x) => x.getData()).returns(async () => ({ label: PropertyRecord.fromString(""), categories: [], records: {} }));
    providerMock1.setup((x) => x.onDataChanged).returns(() => evt1);

    const evt2 = new PropertyDataChangeEvent();
    const providerMock2 = moq.Mock.ofType<IPropertyDataProvider>();
    providerMock2.setup(async (x) => x.getData()).returns(async () => ({ label: PropertyRecord.fromString(""), categories: [], records: {} }));
    providerMock2.setup((x) => x.onDataChanged).returns(() => evt2);

    const { rerender, unmount } = render(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={providerMock1.object} />);
    expect(evt1.numberOfListeners).to.eq(1, "listener should be added when component is mounted");

    rerender(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={providerMock1.object} />);
    expect(evt1.numberOfListeners).to.eq(1, "additional listener should not be added when data provider doesn't change");

    rerender(<VirtualizedPropertyGridWithDataProvider orientation={Orientation.Horizontal} dataProvider={providerMock2.object} />);
    expect(evt1.numberOfListeners).to.eq(0, "listener should be removed when data provider is not used anymore");
    expect(evt2.numberOfListeners).to.eq(1, "listener should be added when data provider changes");

    unmount();
    expect(evt2.numberOfListeners).to.eq(0, "listener should be removed when component is unmounted");
  });
});

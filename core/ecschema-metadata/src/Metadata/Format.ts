/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { InvertedUnit } from "./InvertedUnit";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { Unit } from "./Unit";
import { FormatProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { SchemaItemVisitor } from "./../Interfaces";
import {
  DecimalPrecision, FormatTraits, formatTraitsToArray, FormatType, formatTypeToString,
  FractionalPrecision, parseFormatTrait, parseFormatType, parsePrecision, parseScientificType,
  parseShowSignOption, ScientificType, scientificTypeToString, ShowSignOption, showSignOptionToString,
} from "./../utils/FormatEnums";

export interface IFormat {
  readonly name: string;
  readonly roundFactor: number;
  readonly type: FormatType;
  readonly precision: DecimalPrecision | FractionalPrecision;
  readonly minWidth: number | undefined;
  readonly formatTraits: FormatTraits;
  readonly showSignOption: ShowSignOption;
  readonly decimalSeparator: string;
  readonly thousandSeparator: string;
  readonly uomSeparator: string;
  readonly scientificType?: ScientificType;
  readonly stationSeparator?: string;
  readonly stationOffsetSize?: number;
  readonly spacer?: string;
  readonly includeZero?: boolean;
  readonly units?: Array<[Unit | InvertedUnit, string | undefined]>;
}

export class Format extends SchemaItem implements IFormat {
  public readonly schemaItemType!: SchemaItemType.Format; // tslint:disable-line
  protected _roundFactor: number;
  protected _type: FormatType; // required; options are decimal, frational, scientific, station
  protected _precision: number; // required
  protected _showSignOption: ShowSignOption; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _decimalSeparator: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _thousandSeparator: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _uomSeparator: string; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator: string; // optional; default is "+"
  protected _formatTraits: FormatTraits;
  protected _spacer: string; // optional; default is " "
  protected _includeZero: boolean; // optional; default is true
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _stationOffsetSize?: number; // required when type is station; positive integer > 0
  protected _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Format;

    this._roundFactor = 0.0;
    this._type = FormatType.Decimal;
    this._precision = DecimalPrecision.Six;
    this._showSignOption = ShowSignOption.OnlyNegative;
    this._decimalSeparator = ".";
    this._thousandSeparator = ",";
    this._uomSeparator = " ";
    this._stationSeparator = "+";
    this._formatTraits = 0x0;
    this._spacer = " ";
    this._includeZero = true;
  }

  get roundFactor(): number { return this._roundFactor; }
  get type(): FormatType { return this._type; }
  get precision(): DecimalPrecision | FractionalPrecision { return this._precision; }
  get minWidth(): number | undefined { return this._minWidth; }
  get scientificType(): ScientificType | undefined { return this._scientificType; }
  get showSignOption(): ShowSignOption { return this._showSignOption; }
  get decimalSeparator(): string { return this._decimalSeparator; }
  get thousandSeparator(): string { return this._thousandSeparator; }
  get uomSeparator(): string { return this._uomSeparator; }
  get stationSeparator(): string { return this._stationSeparator; }
  get stationOffsetSize(): number | undefined { return this._stationOffsetSize; }
  get formatTraits(): FormatTraits { return this._formatTraits; }
  get spacer(): string | undefined { return this._spacer; }
  get includeZero(): boolean | undefined { return this._includeZero; }
  get units(): Array<[Unit | InvertedUnit, string | undefined]> | undefined { return this._units; }

  private parseFormatTraits(formatTraitsFromJson: string | string[]) {
    const formatTraits = Array.isArray(formatTraitsFromJson) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    for (const traitStr of formatTraits) {
      const formatTrait = parseFormatTrait(traitStr);
      if (undefined === formatTrait)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'formatTraits' attribute. The string '${traitStr}' is not a valid format trait.`);
      this._formatTraits = this._formatTraits | formatTrait;
    }
  }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  /**
   * Adds a Unit, or InvertedUnit, with an optional label override.
   * @param unit The Unit, or InvertedUnit, to add to this Format.
   * @param label A label that overrides the label defined within the Unit when a value is formatted.
   */
  protected addUnit(unit: Unit | InvertedUnit, label?: string) {
    if (undefined === this._units)
      this._units = [];
    else { // Validate that a duplicate is not added.
      for (const existingUnit of this._units) {
        if (unit.fullName.toLowerCase() === existingUnit[0].fullName.toLowerCase())
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has duplicate units, '${unit.fullName}'.`); // TODO: Validation - this should be a validation error not a hard failure.
      }
    }

    this._units.push([unit, label]);
  }

  protected setPrecision(precision: number) { this._precision = precision; }

  private typecheck(formatProps: FormatProps) {
    const formatType = parseFormatType(formatProps.type);
    if (undefined === formatType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'type' attribute.`);
    this._type = formatType;

    if (undefined !== formatProps.precision) {
      if (!Number.isInteger(formatProps.precision)) // must be an integer
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'precision' attribute. It should be an integer.`);
      const precision = parsePrecision(formatProps.precision, this._type);
      if (undefined === precision)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'precision' attribute.`);
      this._precision = precision;
    }

    if (undefined !== formatProps.minWidth) {
      if (!Number.isInteger(formatProps.minWidth) || formatProps.minWidth < 0) // must be a positive int
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'minWidth' attribute. It should be a positive integer.`);
      this._minWidth = formatProps.minWidth;
    }

    if (FormatType.Scientific === this.type) {
      if (undefined === formatProps.scientificType) // if format type is scientific and scientific type is undefined, throw
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} is 'Scientific' type therefore the attribute 'scientificType' is required.`);
      const scientificType = parseScientificType(formatProps.scientificType);
      if (undefined === scientificType)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'scientificType' attribute.`);
      this._scientificType = scientificType;
    }

    if (FormatType.Station === this.type) {
      if (undefined === formatProps.stationOffsetSize)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} is 'Station' type therefore the attribute 'stationOffsetSize' is required.`);
      if (!Number.isInteger(formatProps.stationOffsetSize) || formatProps.stationOffsetSize < 0) // must be a positive int > 0
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      this._stationOffsetSize = formatProps.stationOffsetSize;
    }

    if (undefined !== formatProps.showSignOption) {
      const signOption = parseShowSignOption(formatProps.showSignOption);
      if (undefined === signOption)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'showSignOption' attribute.`);
      this._showSignOption = signOption;
    }

    if (undefined !== formatProps.formatTraits && formatProps.formatTraits.length !== 0)
      this.parseFormatTraits(formatProps.formatTraits);

    if (undefined !== formatProps.roundFactor)
      this._roundFactor = formatProps.roundFactor;

    if (undefined !== formatProps.decimalSeparator) {
      if (formatProps.decimalSeparator.length > 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'decimalSeparator' attribute. It should be an empty or one character string.`);
      this._decimalSeparator = formatProps.decimalSeparator;
    }

    if (undefined !== formatProps.thousandSeparator) {
      if (formatProps.thousandSeparator.length > 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'thousandSeparator' attribute. It should be an empty or one character string.`);
      this._thousandSeparator = formatProps.thousandSeparator;
    }

    if (undefined !== formatProps.uomSeparator) {
      if (formatProps.uomSeparator.length > 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'uomSeparator' attribute. It should be an empty or one character string.`);
      this._uomSeparator = formatProps.uomSeparator;
    }

    if (undefined !== formatProps.stationSeparator) {
      if (formatProps.stationSeparator.length > 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'stationSeparator' attribute. It should be an empty or one character string.`);
      this._stationSeparator = formatProps.stationSeparator;
    }

    if (undefined !== formatProps.composite) { // TODO: This is duplicated below when the units need to be processed...
      if (undefined !== formatProps.composite.includeZero)
        this._includeZero = formatProps.composite.includeZero;

      if (undefined !== formatProps.composite.spacer) {
        if (formatProps.composite.spacer.length > 1)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has a composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
        this._spacer = formatProps.composite.spacer;
      }

      // Composite requires 1-4 units
      if (formatProps.composite.units.length <= 0 || formatProps.composite.units.length > 4)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'Composite' attribute. It should have 1-4 units.`);
    }
  }

  public deserializeSync(formatProps: FormatProps) {
    super.deserializeSync(formatProps);
    this.typecheck(formatProps);
    if (undefined === formatProps.composite)
      return;

    // Units are separated from the rest of the deserialization because of the need to have separate sync and async implementation
    for (const unit of formatProps.composite.units) {
      const newUnit = this.schema.lookupItemSync<Unit | InvertedUnit>(unit.name);
      if (undefined === newUnit)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.addUnit(newUnit, unit.label);
    }
  }

  public async deserialize(formatProps: FormatProps) {
    super.deserialize(formatProps);
    this.typecheck(formatProps);
    if (undefined === formatProps.composite)
      return;

    // Units are separated from the rest of the deserialization because of the need to have separate sync and async implementation
    for (const unit of formatProps.composite.units) {
      const newUnit = await this.schema.lookupItem<Unit | InvertedUnit>(unit.name);
      if (undefined === newUnit)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.addUnit(newUnit, unit.label);
    }
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.type = formatTypeToString(this.type!);
    schemaJson.precision = this.precision;

    // this._spacer = " ";
    // this._includeZero = true;

    // Serialize the minimal amount of information needed so anything that is the same as the default, do not serialize.
    if (0.0 !== this.roundFactor) schemaJson.roundFactor = this.roundFactor;
    if (ShowSignOption.OnlyNegative !== this.showSignOption) schemaJson.showSignOption = showSignOptionToString(this.showSignOption);
    if (0x0 !== this.formatTraits) schemaJson.formatTraits = formatTraitsToArray(this.formatTraits);
    if ("." !== this.decimalSeparator) schemaJson.decimalSeparator = this.decimalSeparator;
    if ("," !== this.thousandSeparator) schemaJson.thousandSeparator = this.thousandSeparator;
    if (" " !== this.uomSeparator) schemaJson.uomSeparator = this.uomSeparator;

    if (undefined !== this.minWidth) schemaJson.minWidth = this.minWidth;

    if (FormatType.Scientific === this.type && undefined !== this.scientificType)
      schemaJson.scientificType = scientificTypeToString(this.scientificType);

    if (FormatType.Station === this.type) {
      if (undefined !== this.stationOffsetSize)
        schemaJson.stationOffsetSize = this.stationOffsetSize;
      if (" " !== this.stationSeparator)
        schemaJson.stationSeparator = this.stationSeparator;
    }

    if (undefined === this.units)
      return schemaJson;

    schemaJson.composite = {};

    if (" " !== this.spacer) schemaJson.composite.spacer = this.spacer;
    if (true !== this.includeZero) schemaJson.composite.includeZero = this.includeZero;

    schemaJson.composite.units = [];
    for (const unit of this.units) {
      schemaJson.composite.units.push({
        name: unit[0].fullName,
        label: unit[1],
      });
    }

    return schemaJson;
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}

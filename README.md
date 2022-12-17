# inventree-bulk-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![CI](https://github.com/wolflu05/inventree-bulk-plugin/actions/workflows/ci.yml/badge.svg)

> :warning: This plugin is currently in beta because it needs to be properly tested to be used in production.

A bulk creation plugin for [InvenTree](https://inventree.org), which helps you generating locations/categories in bulk by using customized naming strategies and ensure them along your complete storage tree.

## Installation

1. Install this plugin as follows:

   ```bash
   pip install git+https://github.com/wolflu05/inventree-bulk-plugin
   ```
   
   Or, add to your `plugins.txt` file:
   
   ```txt
   git+https://github.com/wolflu05/inventree-bulk-plugin
   ```
 
2. Goto your plugin settings and ensure that you allow the use of the url integration and app integration

## Usage

### Bulk create

You can bulk create sub-stocklocations and sub-partcategories. Goto one and use the panel "Bulk-creation". Either load a [saved template](#saved-templates) or set up the output quickly. Use "Preview" to see how the bulk creation will look like and create to bulk create the locations/categories. To see how this editor works see [bulk creation editor](#bulk-creation-editor).

### Saved templates

You can save bulk creation templates to ensure consistency along your storage trees. Let's say you have a bunch of drawer towers. With saved templates you can now easily store your templates to re-use it when you want to add a new tower to the system.

1. Goto the stock index and select the "Manage bulk creation" panel.
2. Click on "New Template".
3. Adjust the schema to your needs and use "Preview" to see how the creation will look like
4. Create you template by using "Create"
5. Goto the specific sub-location where you want to apply that template, load it and Bulk generate your locations to your needs.

> :information_source: You can use inputs to make your bulk creation schema dynamic in amount of drawers or their names.

### Bulk creation editor

#### Input

You can define key/value pairs of inputs which you can later reference in your schema via `{inp.<key>}`. This is useful for [saved templates](#saved-templates).

#### Settings

- `Count from` - defines from where to start with counting numbers in dimensions.
- `Leading zeros` - defines if it needs to add leading zeros to numbers to ensure consistent length.

#### Templates

You can define templates from which you can later extend in your output. Template values can also be overwritten.

- `Template name` - Template name, is later used to select for extending

For the rest of the fields see [output](#output).

#### Output

##### Parent name match
First child that matches the parent name matcher regex will be chosen for generating the child's for a specific parent.

##### Extends
Select a template to extend from

##### Dimensions/Count
Dimensions are a way to add various counting strategies to your naming. You can add a dimension by clicking on "Add dimension" and remove it via the red "X" on the right of the dimension field.

A `dimension` can be either specify a range or a generic name. You can use the count field to limit a generic dimension to a specific amount of generating items.

Ranges: `A-G`,`f-x`, `1-3`, `A-XZ`
Generics: `NUMERIC` (0-9), `ALPHA_LOWER` (a-...), `ALPHA_UPPER` (A-...). 

##### Generate

These fields my differ between stock location and part category. They correspond to the generated items property. For example "Generate Name" will be the name of the created location/category. 

> :information_source: You can use `{dim.<x>}` as a placeholder for the generated output of the dimension and `{inp.<key>}` for replacing with the given input value. Dimension numbering is starting with 1, so you can reference the value of the first dimension via `{dim.1}`.

##### Child's

Child's are a way to add some nesting to your bulk creation tree. You can use them for e.g. generating sections in every of your drawer. You can use the [Parent name match](#parent-name-match) option to add for your drawers named from `Drawer 1` - `Drawer 10` two sections while your other drawers have different sections. 

## FAQ

#### Why does this plugin needs the App Mixin?

> This plugin uses the App Mixin to add a custom model to the database to manage stored templates which ensure consistency along your creation of storage trees. (See [Saved templates](#saved-templates))

#### Why does this plugin needs the Url Mixin?

> This plugin uses the Url Mixin to expose custom API endpoints for previewing and bulk create locations.

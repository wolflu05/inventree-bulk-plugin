# inventree-bulk-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![CI](https://github.com/wolflu05/inventree-bulk-plugin/actions/workflows/ci.yml/badge.svg)

> [!WARNING]
> This plugin is currently in beta because it needs to be properly tested to be used in production.

A bulk creation plugin for [InvenTree](https://inventree.org), which helps you generating locations/categories in bulk by using customized naming strategies and ensure them along your complete storage tree.

## Installation

Install this plugin as follows:

1. Make sure you allow the use of the url integration and app integration (see [Why does this plugin needs the app mixin?](#why-does-this-plugin-needs-the-app-mixin))

2. Goto Settings > Plugins > Install Plugin, enter `inventree-bulk-plugin` as package name. Enable the confirm switch and click submit.

3. Restart your server and activate the plugin.

4. Stop your server and run `invoke update` (for docker installs it is `docker-compose inventree-server invoke update`). This ensures that all migrations run and the static files get collected. You can now start your server again and start using the plugin.

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

> [!NOTE]
> You can use [inputs](#input) to make your bulk creation schema dynamic in amount of drawers or their names.

### Bulk creation editor

The bulk creation editor helps you to define the generation schema. 

> [!NOTE]
> You can use [Jinja2 templating](https://jinja.palletsprojects.com/en/3.1.x/templates/) in every field (except in the `input` section). You can also use filters to manipulate the dimension output.
> **Global context:**
> - `inp.<key>` - Access [input variables](#input), e.g. (`{{inp.drawer_count|int / 2}}`)

#### Input

You can define key/value pairs of inputs which you can later reference in your schema via `{{inp.<key>}}`. This is useful for [saved templates](#saved-templates) to dynamically generate the amount of locations as you want, but still keep the structure.

#### Settings

- `Count from` - defines from where to start with counting numbers in dimensions.
- `Leading zeros` - defines if it needs to add leading zeros to numbers to ensure consistent length.

> [!NOTE]
> :construction: These settings are currently not working - see [#18](https://github.com/wolflu05/inventree-bulk-plugin/issues/18)

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

A `dimension` can contain comma separated generators which generate the values for you. There are three types of generators. You can use the `count` field to limit a dimension to a specific amount of generating items. These generators can have arguments parsed via the following syntax: `GENERATOR(key1=value,key2=value)`, where `GENERATOR` is the name/range. <br/>

**Generator types:**<br/>
Word: _any arbitrary word, not starting with `*`_. E.g. `hello world`<br/>
Ranges: _ranges are defined with a - in the middle_ E.g. `a-bx`<br/>
Infinity: _infinity generators start with a *_ E.g. `*NUMERIC`<br/>

**Available Generators:**<br/>
Numeric generator: `*NUMERIC(start=0,end=10,step=2,count=5}` or `0-10(step=2}`<br/>
Alpha generator: `*ALPHA(casing=upper|lower,start=A,end=F,step=2,count=3)` or `a-z(step=2)`<br/><br />

Example: `1-3,hello,*NUMERIC(start=1,step=2,end=10),*ALPHA(casing=upper,end=B),A-D(step=2)`, this will generate the following dimension: `12,3,hello,1,3,5,7,9,A,B,A,C`.

> [!IMPORTANT]
> Infinity generators need a `count` argument or a global count limitation, otherwise generation will fail.

##### Generate

These fields my differ between stock location and part category. They correspond to the generated items property. For example "Generate Name" will be the name of the created location/category. 

> [!NOTE]
> **Extended Jinja2 context**:
> - `dim.<x>` - n-th dimension, one-based (e.g. `{{dim.1}}` to access the first dimension)
> - `par.<...>` - parent's context
> - `par.dim.<x>` - parents's dimensions
> - `par.gen.<name>` - parent's generated fields (e.g. to reuse the parents name `{{par.gen.name}}`)  
> - `par.par.<...>` - parent's parent context, can be nested deeply

##### Child's

Child's are a way to add some nesting to your bulk creation tree. You can use them for e.g. generating sections in every of your drawer. You can use the [Parent name match](#parent-name-match) option to add for your drawers named from `Drawer 1` - `Drawer 10` two sections while your other drawers have different sections. 

## FAQ

#### Why does this plugin needs the App Mixin?

> This plugin uses the App Mixin to add a custom model to the database to manage stored templates which ensure consistency along your creation of storage trees. (See [Saved templates](#saved-templates)). Additionally the App Mixin is used to provide the static files that are required for the reactive interface powered by preact.

#### Why does this plugin needs the Url Mixin?

> This plugin uses the Url Mixin to expose custom API endpoints for previewing and bulk create locations.

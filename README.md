# inventree-bulk-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![CI](https://github.com/wolflu05/inventree-bulk-plugin/actions/workflows/ci.yml/badge.svg)

This plugin helps you bulk create storage locations and part categories in [InvenTree](https://inventree.org/) by using customized naming strategies. That means you not only have the option to generate multidimensional\* names for stock locations or part categories, but also have the option to save the templates for later usage if your storage room uses e.g. drawer towers, saved templates help to ensure naming consistency for all later added towers.

> [!NOTE]
> multidimensional means that you are not limited to namings like `D1`,`D2`, .. but also something like `D1.A`, `D1.B`, `D2.A`, `D2.B`, ...

## 🌟Screenshots

<details open>
<summary>This will generate the previous mentioned example:</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/c1ad6ccd-bc27-445b-a3fc-ae5ce74390b5)

If you want to try out the templates on you're own, you can just copy the below json to your clipboard and use the "New untitled schema from clipboard" button to import them (see [import/export](#import-export)).

<!-- prettier-ignore-start -->
```json
{"name":"Example","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC","*ALPHA"],"count":["3","2"],"generate":{"name":"D{{dim.1}}.{{dim.2}}"},"childs":[]}}}
```
<!-- prettier-ignore-end -->

</details>

### 📄 Some more examples

<details>
<summary>But even nested generations don't stop you.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/07d688da-b9e3-47ba-bf5b-ab44685c888a)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["3"],"generate":{"name":"D{{dim.1}}"},"childs":[{"parent_name_match":"true","dimensions":["*ALPHA(casing=upper)"],"count":["2"],"generate":{"name":"{{par.gen.name}}-{{dim.1}}"}}]}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>And with parent name match, you can even generate different sub-locations depending of the name of the parent.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/83d8422f-d600-4bd3-991a-cdf2775b471b)
![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/2dace3ea-a629-4a3b-b52e-9103ccffca50)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["3"],"generate":{"name":"D{{dim.1}}"},"childs":[{"parent_name_match":"{{par.gen.name == \"D1\"}}","dimensions":["*ALPHA"],"count":["2"],"generate":{"name":"D.{{dim.1}}"}},{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["1"],"generate":{"name":"{{dim.1}}"}}]}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>Pad your numeric dimensions with zeros.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/5cf35065-33c8-4e71-b04c-6fa541b2d821)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["100"],"generate":{"name":"D{{dim.1.zfill(dim.1.len|string|length)}}"},"childs":[]}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>Extend from a template.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/cd23b6af-995f-4220-bb54-d539af1a41ad)
![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/8e303f31-2890-4cbe-87f7-9c02a453445e)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[{"name":"Drawer sections","parent_name_match":"true","dimensions":["*ALPHA"],"count":["2"],"generate":{"name":"{{par.gen.name}} Section {{dim.1}}"}}],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["100"],"generate":{"name":"D{{dim.1.zfill(dim.1.len|string|length)}}"},"childs":[{"parent_name_match":"true","dimensions":[""],"count":[""],"generate":{"name":""},"extends":"Drawer sections"}]}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>Use more generate keys.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/6d6f2105-b565-4aaf-aa31-723dc542d40f)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["100"],"generate":{"name":"D{{dim.1}}","description":"Drawer {{dim.1}}","structural":"{{dim.1|int<=3}}","external":true}}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>Using input to reuse a saved template.</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/d547a6b5-7d26-40bf-ad49-085eb7d283b0)

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"STOCK_LOCATION","template":{"version":"1.0.0","input":{"drawers":"10"},"templates":[],"output":{"parent_name_match":"true","dimensions":["*NUMERIC"],"count":["{{inp.drawers}}"],"generate":{"name":"D{{dim.1}}"},"childs":[]}}}
```
<!-- prettier-ignore-end -->

</details>

<details>
<summary>And then use the preview/bulk create form</summary>

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/0d799bcd-585e-4f7e-a30a-e0070a57a776)

</details>

<details>
<summary>Use the global context</summary>

You can use the global context for some more complex things like generating resistor values in e.g. the E12 row.
![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/6e2ddf3d-ea9c-4479-ac53-5bad88b79dcf)
![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/a3cc5a60-229e-4509-8d54-eef8563fa922)

<!-- prettier-ignore-start -->
```json
{"name":"Resistors","template_type":"PART","template":{"version":"1.0.0","input":{"packages":"0805,1206","tolerances":"5,10"},"templates":[],"output":{"parent_name_match":"true","dimensions":["{{inp.packages}}","{{inp.tolerances}}","0-8","1-12"],"count":[null,null,null,null],"generate":{"name":"R_{{global.formatted_value}}_{{dim.2}}%_{{dim.1}}","parameters":[{"template":"2","value":"{{global.formatted_value}}"},{"template":"3","value":"{{dim.2}}%"},{"template":"1","value":"{{dim.1}}"}]},"global_context":"{% set values = [1,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2] %}\n{% set units = [\"\", \"k\", \"M\"] %}\n\n{% set value = values[dim.4|int-1] * 10 ** (dim.3|int) %}\n{% set formatted_value = \"{:.1f}\".format(value * 10 ** -(dim.3|int//3*3)).removesuffix(\".0\").replace(\".\", \",\") + units[dim.3|int//3] + \"Ω\" %}\n"}}}
```
<!-- prettier-ignore-end -->

</details>

## ⚙️ Installation

Install this plugin as follows:

1. Make sure you allow the use of the url integration and app integration (see [Why does this plugin needs the app mixin?](#why-does-this-plugin-needs-the-app-mixin))

2. Goto Settings > Plugins > Install Plugin, enter `inventree-bulk-plugin` as package name. Enable the confirm switch and click submit.

3. Restart your server and activate the plugin.

4. Stop your server and run `invoke update` (for docker installs it is `docker-compose inventree-server invoke update`). This ensures that all migrations run and the static files get collected. You can now start your server again and start using the plugin.

> [!IMPORTANT]
> At least InvenTree v0.12.7 is required to use this plugin.

## 🏃 Usage

You can bulk create sub-stocklocations, sub-partcategories and parts (See [generate types](#generation-types)). Go to one and use the bulk creation panel on the side for the type you want to generate. Edit a [saved template](#saved-templates) with the [bulk creation editor](#bulk-creation-editor) or create a new untitled to setup a generation quickly. Use ["Preview/Bulk create"](#previewbulk-create) to bulkcreate using a saved template in combination with inputs. Templates can als be [imported and exported](#import-export) from clipboard or a file which is useful if you want to follow along with the documentation. On most places this documentation shows the template in a codeblock with a copy button.

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/a28ededb-72a8-499c-be55-e23f9557a2fa)

### Saved templates

You can save bulk creation templates to ensure consistency along your storage trees. Let's say you have a bunch of drawer towers. With saved templates you can now easily store your templates to re-use it when you want to add a new tower to the system.

> [!NOTE]
> You can use [inputs](#input) to make your bulk creation schema dynamic in amount of drawers or their names and then use the [preview/bulk create](#previewbulk-create) dialog to quickly generate objects at different locations.

### Import export

Templates can be imported and exported into the clipboard or can be downloaded as a file. Use the dropdown menu at the right of the "New untitled template" button for importing. Exporting can be done from the [editor view](#bulk-creation-editor) with the clipboard/download icon button.

### Preview/Bulk create

The preview bulk create dialog can be used to quickly generate objects at different locations by using inputs to make them dynamic. One use case would be the Resistor part generation template shown at the [screenshot section](#📄-some-more-examples).

### Bulk creation editor

The bulk creation editor helps you to define the generation schema.

#### Jinja2

You can use [Jinja2 templating](https://jinja.palletsprojects.com/en/3.1.x/templates/) in every field (except in the `input` section). You can also use filters to manipulate the dimension output.

##### Global jinja2 context

- `inp.<key>` - Access [input variables](#input), e.g. (`{{inp.drawer_count|int / 2}}`)

##### Extra useful filters

- `to_json(value: Any, **kwargs)` - Convert any value into a json string. Uses the `json.dumps` method from python under the hood, therefore [these](https://docs.python.org/3/library/json.html#json.dumps) `kwargs` are available.
- `from_json(value: str, **kwargs)` - Convert a string value into a python variable. Uses the `json.loads` method from python under the hood, therefore [these](https://docs.python.org/3/library/json.html#json.loads) `kwargs` are available.
- `to_csv(value: list[dict[str, str]], **kwargs)` - Convert a csv like python list of dicts to a csv string. Uses the `csv.DictWriter` method from python under the hood, therefore [these](https://docs.python.org/3/library/csv.html#csv.DictWriter) `kwargs` are available.
- `from_csv(value: str, **kwargs)` - Convert a string value in csv structure into a python list of dicts. Uses the `csv.DictReader` method from python under the hood, therefore [these](https://docs.python.org/3/library/csv.html#csv.DictReader) `kwargs` are available.

##### Debug tools

- `debug` - the debug command from jinja2 is available too and can be used as `{% debug %}`, see [jinja2 docs](https://jinja.palletsprojects.com/en/3.1.x/templates/#debug-statement)

#### Input

You can define key/value pairs of inputs which you can later reference in your schema via `{{inp.<key>}}`. This is useful for [saved templates](#saved-templates) to dynamically generate the amount of locations as you want, but still keep the structure.

#### Templates

You can define templates from which you can later extend in your output. Template values can also be overwritten.

- `Template name` - Template name, is later used to select for extending

For the rest of the fields see [output](#output).

#### Output

##### Parent name match

First child that matches the parent name matcher will be chosen for generating the child's for a specific parent. This must evaluate to something that can be casted to a boolean. You can use Jinja2 for dynamically decide based on the parent. E.g. `{{par.gen.name == "D1"}}`. The global jinja2 and `par` context is available here.

##### Extends

Select a template to extend from

##### Global context

Global context can be used to set up some more complex variables and reuse them between fields. Under the hood this template gets imported as `global` by prepending `{% import global_context_template as global with context %}` to every generate field. Therefore you can also use the dimensions and every available context variable there too. But note that the defined variables are only valid in that parent they are defined in, not in their childs. This is a limitation of the import function of jinja2 templates.

##### Dimensions/Count

Dimensions are a way to add various counting strategies to your naming. You can add a dimension by clicking on "Add dimension" and remove it via the red "X" on the right of the dimension field.

A `dimension` can contain comma separated generators which generate the values for you. There are three types of generators. You can use the `count` field to limit a dimension to a specific amount of generating items. These generators can have arguments parsed via the following syntax: `GENERATOR(key1=value,key2=value)`, where `GENERATOR` is the name/range. <br/>

**Generator types:**<br/>
Word: _any arbitrary word, not starting with `*`_. E.g. `hello world`<br/>
Ranges: _ranges are defined with a `-` in the middle_ E.g. `a-bx`<br/>
Infinity: _infinity generators start with a `*`_ E.g. `*NUMERIC`<br/>

**Available Generators:**<br/>
Numeric generator: `*NUMERIC(start=0,end=10,step=2,count=5)` or `0-10(step=2)`<br/>
Alpha generator: `*ALPHA(casing=upper|lower,start=A,end=F,step=2,count=3)` or `a-z(step=2)`<br/><br />

Example: `1-3,hello,*NUMERIC(start=1,step=2,end=10),*ALPHA(casing=upper,end=B),A-D(step=2)`, this will generate the following dimension: `1,2,3,hello,1,3,5,7,9,A,B,A,C`.

> [!IMPORTANT]
> Infinity generators need a `count` argument or a global count limitation, otherwise generation will fail.

##### Generate

These fields my differ between the different available generate objects. They correspond to the generated items property. For example "Name" will be the name of the created location. For more info and also about the available jinja2 context, see [generation types](#generation-types).

Generate fields can be added with just one click from a list of available fields. If you're missing an field, please [open an issue](https://github.com/wolflu05/inventree-bulk-plugin/issues/new/choose). There are several different types of inputs for native values like numbers, booleans, model references, ... . You can either use the native fields or switch to template mode by clicking on the blue template icon on the right.

- Boolean fields then must evaluate to something that can be interpreted as a boolean like `true` or `false`.
- Number fields then must evaluate to a number
- Model reference fields then must evaluate to a valid id

![image](https://github.com/wolflu05/inventree-bulk-plugin/assets/76838159/ed4f5a16-2beb-4a63-8626-a833d6f0084b)

##### Child's

Child's are a way to add some nesting to your bulk creation tree. You can use them for e.g. generating sections in every of your drawer. You can use the [Parent name match](#parent-name-match) option to add for your drawers named from `Drawer 1` - `Drawer 10` two sections while your other drawers have different sections.

### Generation types

You can bulk create sub-stocklocations, sub-partcategories and [parts](#parts) with there different options. All of those are tree objects, that means objects that can have childs and extend from templates that can be defined.

<!-- These objects can be categorized into two different generation groups, [Tree objects](#tree-objects) and [normal objects](#normal-objects).  -->

For all of those, the following context is available.

| Key              | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `len`            | count of elements this child will generate                                    |
| `dim.<x>`        | x-th dimension, one-based (e.g. `{{dim.1}}` to access the first dimension)    |
| `dim.<x>.len`    | count of items the x-th dimension has                                         |
| `par.<...>`      | parent's context                                                              |
| `par.dim.<x>`    | parents's dimensions                                                          |
| `par.gen.<name>` | parent's generated fields (e.g. to reuse the parents name `{{par.gen.name}}`) |
| `par.par.<...>`  | parent's parent context, can be nested deeply                                 |
| `global.<...>`   | Access any variable defined in [global context](#global-context)              |

<!--
Currently there is only one type
#### Tree objects
Tree objects are objects that can have childs and use templates. Currently "stock locations" and "part categories" are supported. In addition to the default context, the following attributes are also available in the context.
| Key              | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |

#### Normal objects

Normal objects are objects that don't have a tree structure and therefore don't need childs and templates. Currently "parts" is the only supported object. There is no additional context.
-->

##### Parts

Parts use the tree generation feature for part variant. You can either generate variants for an already created template part by using the "variants of" attribute (note that for the root generate element, templating is not supported in this field), or create a template part with variants by using the childs feature. The "variant of" field then gets automatically assigned the parent part if its not set for the child. The only thing you need to make sure is that the parent part has set the `is_template: true` option, otherwise creation will fail. The plugin then tries to copy unset fields from the template part if they are not set for the child. Parameters get copied too, even there are parameters defined for the child.

Example:

<!-- prettier-ignore-start -->
```json
{"name":"","template_type":"PART","template":{"version":"1.0.0","input":{},"templates":[],"output":{"parent_name_match":"true","dimensions":[],"count":[],"generate":{"name":"Wall paint","description":"This is awesome paint","is_template":true},"childs":[{"parent_name_match":"true","dimensions":["red,blue,green"],"count":[""],"generate":{"name":"{{par.gen.name}} - {{dim.1}}"}}]}}}
```
<!-- prettier-ignore-end -->

Parts have an additional context:

| Key                  | Description                     |
| -------------------- | ------------------------------- |
| `par.category.<...>` | category fields this part is in |

## 🧑‍💻 Development

1. Install as editable install to your inventree installation via `pip install -e /path/to/inventree-bulk-plugin`
2. Enable the plugin and run `invoke migrate` to run the migration
3. Install js dependencies via `cd inventree_bulk_plugin/frontend && npm ci`
4. Configure the base url of your vite dev server (that you need to start via `npm run dev`) in the InvenTree `config.yml` as e.g. `customize.inventree_bulk_plugin_dev_url: http://localhost:5173`
5. Restart InvenTree and start vite dev server via `npm run dev`

## ❓ FAQ

#### Why does this plugin needs the App Mixin?

> This plugin uses the App Mixin to add a custom model to the database to manage stored templates which ensure consistency along your creation of storage trees. (See [Saved templates](#saved-templates)). Additionally the App Mixin is used to provide the static files that are required for the reactive interface powered by preact.

#### Why does this plugin needs the Url Mixin?

> This plugin uses the Url Mixin to expose custom API endpoints for previewing and bulk create locations.

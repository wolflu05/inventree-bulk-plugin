const form = document.getElementById("bulkcreate-form");
const input = document.getElementById("bulkcreate-input");
const success = document.getElementById("success");
const error = document.getElementById("error");
const btnPreview = document.getElementById("bulkcreate-preview-btn");
const indPreview = document.getElementById("loadingindicator-preview");
const btnCreate = document.getElementById("bulkcreate-create-btn");
const indCreate = document.getElementById("loadingindicator-create");

btnPreview.addEventListener("click", async (e) => {
  e.preventDefault();
  error.innerText = "";
  success.innerText = "";
  btnPreview.disabled = true;
  indPreview.style.display = "inline-block";

  const res = await fetch("{% url 'plugin:bulkaction:parse' %}", {
    method: "POST",
    body: input.value
  });
  const json = await res.json();

  if (res.status !== 200) error.innerText = "An error occourd";
  else success.innerText = "Successfully parsed";
  btnPreview.disabled = false;
  indPreview.style.display = "none";

  const getCounter = (i = 1) => () => i++
  const toFlat = (data, counter, pid = 0, pa = "...") => data.flatMap(([parent, childs]) => {
    const id = counter();
    const path = `${pa}/${parent.name}`
    return [{ ...parent, id, pid, path }, ...toFlat(childs, counter, id, path)]
  });

  const data = toFlat(json, getCounter());

  const $table = $("#table");
  $table.bootstrapTable({
    data: data,
    idField: 'id',
    showColumns: true,
    columns: [
      { field: 'name', title: 'Name' },
      { field: 'description', title: 'Description' },
      { field: 'path', title: 'Path' }
    ],
    treeShowField: 'name',
    parentIdField: 'pid',
    onPostBody: function () {
      var columns = $table.bootstrapTable('getOptions').columns

      if (columns && columns[0][1].visible) {
        $table.treegrid({
          treeColumn: 0,
          onChange: function () {
            $table.bootstrapTable('resetView')
          }
        })
      }
    },
    rowStyle: () => ({
      css: {
        padding: "2px 0.5rem"
      }
    })
  });
});

btnCreate.addEventListener("click", async (e) => {
  e.preventDefault();
  error.innerText = "";
  success.innerText = "";
  btnCreate.disabled = true;
  indCreate.style.display = "inline-block";

  const res = await fetch("{% url 'plugin:bulkaction:bulkcreate' pk=location.id %}", {
    method: "POST",
    body: input.value
  });

  if (res.status !== 201) error.innerText = "An error occourd";
  else success.innerText = "Successfully created";
  btnCreate.disabled = false;
  indCreate.style.display = "none";
});

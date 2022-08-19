{% load i18n %}
{% load inventree_extras %}
{% load status_codes %}

const templateFields = (options = {}) => {
  return {
    name: {},
    template: {},
  }
}

const createNewTemplate = (options = {}) => {
  const url = "abc";

  options.title = '{% trans "New bulk template" %}'
  options.method = 'POST';

  options.create = true;

  options.fields = templateFields(options);
  options.groups = {};

  options.onSuccess = (response) => {
    console.log(response)
  }

  constructForm(url, options);
}

$('#template-create').click(function () {
  console.log("AC")
  createNewTemplate();
});

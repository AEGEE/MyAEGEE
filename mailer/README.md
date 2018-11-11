# Omsmailer

This is a simple elixir app which waits for requests on a json api and then delivers mails rendered into templates, including retries and tls to the aegee mail server.

Documentation of the single API route can be found on [apiary](https://omsmailer.docs.apiary.io/)

If you want to create a custom template, copy one of the existing ones in the lib/omsmailer_web/templates/page folder. If you have optional parameters, include them with ```<%= parameters["optional_parameter"] %>```. If you have required parameters, include them with ```<%= Map.fetch!(parameters, "required_parameter") %>```. 
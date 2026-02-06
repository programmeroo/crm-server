# Pi-CRM Server App

The name of the project is pi-server and the app name is pi-crm. 

- The purpose is to provide a CRM for home use.
- The dev machine is WSL/Ubuntu 20.04.
- The host machine is a Raspberry Pi Ubuntu.
- Server is Node.js and Database is SQLite.
- Frontend is Server-Side-Rendering and Tailwind.

## Features

- There are 2 users, Andy and Monalisa.
- Andy has several applications for the CRM, so the datasets will be segmented by the user and project.
   For example, Andy has Loan Factory contacts, Mai Story prospecting, AI Consulting contacts, other contacts for different projects.
   The marketing campaigns, messages, contact notes and AI interactions need to be specific to the project.
   Intra-project communication and tracking should be a built-in feature. For example, if a contact is is in more than one project the app should be aware
   and make sure AI interactions apply to the correct project.
- We need to come up with a more specific term than role/project.
- The app must have the ability to export contacts to csv files. 
- The emails are sent using using mail-merge or directly.
- The CRM has a functionality similar to LionDesk, where templates can be selected and saved as a new template.
- Data can be shared between Andy and Monalisa. We sometimes will work with the same client.
- Sharing should be simple, a link to share with Monalisa's client or a link to update Andy & Monalisa's client loan progress.
- Text a contact to our phones using Twilio.
- Contact data basic and details pages:
   Basic: id, created_on, first_name, last_name, email_address, phone, company, last_contact
   Details: birthday, marrital_status, spouse_id, kids_names, pet_names, referred_by, transactions, notes.
- Communication log including text, phone, email, AI interactions, and link or email to transaction management or Loan File.
- A Dashboard gives status of campaigns, Todos, and any activity that needs attention, including AI comments and message approvals.
- AI monitors activity and make suggestions for app improvement of future expansion. As AI becomes smarter and better at improving things, this would become a 
   tool that I would use to develop other tools for income.

## Campaign Templates

- The templates can be scheduled for a number of days from now at a scheduled time or send immediately.
- Template Creation tool including the ability to insert images with link to user website.
- AI to create template or manual create.
- Campaign status page gives a detail view sent & opened.
- Campaign sent status will be emailed to the user.

## AI Communications 

- Create an AI agent to interface with the app.
- AI to create marketing messages and visual communications.
- AI to create templates.
- AI to execute the workflow for sending template to Loan Factory marketing for approval (Andy).



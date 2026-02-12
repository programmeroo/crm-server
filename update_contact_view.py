import re

# Read the file
with open('/home/andy/crm-server/views/contacts/detail.ejs', 'r') as f:
    content = f.read()

# Find the placeholder section
placeholder_start = content.find('<!-- Activity Logging Section (Placeholder) -->')
if placeholder_start == -1:
    print('ERROR: Could not find placeholder section')
    exit(1)

placeholder_end = content.find('</div>\n        </div>', placeholder_start) + len('</div>\n        </div>')

# Extract the section to replace
section_to_replace = content[placeholder_start:placeholder_end]

# New content for communication history and todos
new_section = '''<!-- Communication History Section -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-slate-900">Communication History</h3>
                <button onclick="toggleModal('log-communication-modal')" class="text-blue-600 font-bold text-xs hover:underline">Log Communication</button>
            </div>
            <div id="communication-filters" class="flex gap-2 mb-4 overflow-x-auto pb-2">
                <button onclick="filterCommunications('all')" class="filter-btn px-3 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">All</button>
                <button onclick="filterCommunications('email')" class="filter-btn px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">Emails</button>
                <button onclick="filterCommunications('text')" class="filter-btn px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">Texts</button>
                <button onclick="filterCommunications('call')" class="filter-btn px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">Calls</button>
                <button onclick="filterCommunications('note')" class="filter-btn px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">Notes</button>
            </div>
            <div id="communication-logs" class="space-y-3 max-h-96 overflow-y-auto">
                <% if (!communicationLogs || communicationLogs.length === 0) { %>
                    <div class="text-center py-8 text-slate-400 text-sm">No communication history yet. Log your first interaction.</div>
                <% } else { %>
                    <% communicationLogs.forEach(log => { %>
                        <div class="communication-log" data-type="<%= log.type %>">
                            <div class="flex gap-3 pb-3 border-b border-slate-100 last:border-b-0">
                                <div class="flex-shrink-0">
                                    <% if (log.type === 'email') { %>
                                        <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
                                    <% } else if (log.type === 'text') { %>
                                        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"></path><path d="M6 7h8v2H6V7zm0 3h8v2H6v-2zm0 3h4v2H6v-2z" fill="white"></path></svg>
                                    <% } else if (log.type === 'call') { %>
                                        <svg class="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.23.615a16.864 16.864 0 006.837 6.837l.615-1.23a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2.57a16.864 16.864 0 01-16.864-16.864V3z"></path></svg>
                                    <% } else { %>
                                        <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h6a2 2 0 012 2v12a1 1 0 110 2h-2.343l-2.828-2.828A2 2 0 0013 15V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H4v12zm5 4h2v6H9V8z"></path></svg>
                                    <% } %>
                                </div>
                                <div class="flex-grow min-w-0">
                                    <div class="flex items-center justify-between">
                                        <h4 class="font-semibold text-sm text-slate-900"><%= log.type.charAt(0).toUpperCase() + log.type.slice(1) %></h4>
                                        <span class="text-xs text-slate-400"><%= new Date(log.timestamp).toLocaleDateString() %></span>
                                    </div>
                                    <% if (log.type === 'email') { %>
                                        <p class="text-sm text-slate-600 truncate"><strong>Subject:</strong> <%= log.content.subject %></p>
                                        <p class="text-xs text-slate-500 truncate"><%= log.content.body.substring(0, 80) %>...</p>
                                    <% } else if (log.type === 'text') { %>
                                        <p class="text-sm text-slate-600"><%= log.content.message %></p>
                                    <% } else if (log.type === 'call') { %>
                                        <p class="text-sm text-slate-600"><strong>Duration:</strong> <%= log.content.duration %> min</p>
                                        <% if (log.content.notes) { %><p class="text-xs text-slate-500"><%= log.content.notes %></p><% } %>
                                    <% } else { %>
                                        <p class="text-sm text-slate-600"><%= log.content.text %></p>
                                    <% } %>
                                </div>
                            </div>
                        </div>
                    <% }) %>
                <% } %>
            </div>
        </div>

        <!-- Todos Section -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-slate-900">Action Items</h3>
                <button onclick="toggleModal('add-todo-modal')" class="text-blue-600 font-bold text-xs hover:underline">Add Todo</button>
            </div>
            <div id="todos-list" class="space-y-2">
                <% if (!todos || todos.length === 0) { %>
                    <div class="text-center py-8 text-slate-400 text-sm">No action items yet.</div>
                <% } else { %>
                    <% todos.forEach(todo => { %>
                        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                            <input type="checkbox" onchange="markTodoComplete(<%= todo.id %>)" <%= todo.is_complete ? 'checked' : '' %>
                                class="w-4 h-4 rounded border-slate-300">
                            <div class="flex-grow">
                                <p class="text-sm <%= todo.is_complete ? 'line-through text-slate-400' : 'text-slate-900 font-medium' %>"><%= todo.text %></p>
                                <% if (todo.due_date) { %>
                                    <p class="text-xs text-slate-500">Due: <%= new Date(todo.due_date).toLocaleDateString() %></p>
                                <% } %>
                            </div>
                        </div>
                    <% }) %>
                <% } %>
            </div>
        </div>'''

# Replace
content = content[:placeholder_start] + new_section + content[placeholder_end:]

# Write back
with open('/home/andy/crm-server/views/contacts/detail.ejs', 'w') as f:
    f.write(content)

print('Communication history and todos sections added to contact detail view')

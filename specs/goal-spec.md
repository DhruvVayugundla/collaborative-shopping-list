# Goal Spec — Collaborative Shopping List

## 1. Problem Statement

People living together, such as family members, roommates, and groups of friends, often manage shopping lists through messaging apps, notes, or verbal communication. This can lead to duplicate purchases, forgotten items, and confusion about what has already been purchased. This application provides a shared shopping list where multiple users can add items, update their status, and track estimated expenses in one place.

## 2. Target Users

Anyone who needs to coordinate shopping with other people, including families, roommates, college students living in hostels, and groups of friends.

## 3. Core Use Cases

- As a user, I want to create a shopping list so that I can organize the items I need to purchase.
- As a user, I want to share a shopping list with other users so that we can manage shopping together.
- As a user, I want to add, edit, and remove items from a list so that the list stays up to date.
- As a user, I want to mark items as purchased so that other members know which items are already bought.
- As a user, I want to view the estimated cost of the shopping list so that I can manage my budget.
- As a user, I want changes to be reflected for all members in real time so that everyone has the latest version of the list.

## 4. Core Features (MVP)

- Responsive web application usable on desktop and mobile browsers.
- User registration and login using a username and password.
- Users can create, rename, and delete shopping lists.
- Users can add items with a name, quantity, and estimated price.
- Users can edit and remove items from a shopping list.
- Users can mark items as purchased or pending.
- Users can share lists with other registered users through an invitation mechanism.
- Shared list changes are synchronized in real time for all authorized members.
- Users can view their created and shared shopping lists.
- The application displays the total estimated cost of items on each list.
- AI quick-add (optional, needs a Groq API key): paste or type a free-text list and an LLM turns it into items with quantities and any stated prices. The user reviews the items before adding them. It only reads what the user wrote and never suggests items, so it does not conflict with the "AI-generated shopping recommendations" exclusion below.

## 5. Nice-to-Have Features (Post-MVP)

- Email-based registration and account verification.
- Notifications when members add items or mark them as purchased.
- Activity history showing who added, edited, or purchased an item.
- Categorization of items, such as groceries, household supplies, and personal care.
- Shopping history and frequently purchased item suggestions.
- Actual expense tracking and comparison with the estimated budget.

## 6. Out of Scope

- Online purchasing and payment processing.
- Direct integration with supermarket inventory or pricing systems.
- Product delivery and order tracking.
- AI-generated shopping recommendations.
- Native Android or iOS applications.

## 7. Success Metrics

- A user can register and log in successfully.
- A user can create and manage shopping lists.
- A user can add, edit, remove, and mark items as purchased.
- A user can share a list with another authorized user.
- Changes made by one member appear for other connected members in real time.
- The application correctly calculates the estimated total cost of a shopping list.
- Users can view their own lists and lists shared with them.
- The application works correctly on desktop and mobile browsers.

## 8. Constraints & Assumptions

- Timeline: 2 weekends.
- Team Size: 1 person.
- Target Platform: Responsive web application; no native mobile app.
- The application requires an internet connection for real-time collaboration.
- Only authenticated and authorized users can access shared lists.
- The backend and database are responsible for storing and validating changes.
- Real-time updates will be implemented using WebSockets or Socket.IO.

## 9. Glossary

| Term | Definition |
|---|---|
| User | A registered person who can create, view, and manage shopping lists. |
| Shopping List | A collection of items organized for a shopping task, owned by a user or shared with a group. |
| Item | A product or supply entry containing a name, quantity, estimated price, and purchase status. |
| List Owner | The user who creates a shopping list and manages its sharing permissions. |
| Member | An authorized user who has access to a shared shopping list. |
| Collaboration | The ability of multiple authorized users to view and update the same shopping list. |
| Real-Time Synchronization | The process of reflecting changes made by one user to other connected users without requiring a manual refresh. |
| Purchase Status | Indicates whether an item is pending or has been purchased. |
| Estimated Cost | The expected cost of an item or the sum of estimated item costs in a shopping list. |
| Invitation | A mechanism that allows a list owner to grant another user access to a shopping list. |

# Fix customer creation on insurance claims

## What will change
- Add customer search and “New customer” controls directly to an existing insurance claim.
- Save the new customer first, link it to the claim, then allow the motorcycle to be created with that customer.
- Prevent motorcycle creation when no customer is linked, replacing the database error with a clear prompt.

## Verification
- Test creating and linking a customer on a claim that currently has none.
- Test creating the motorcycle afterward and confirm both links persist.
- Check the current app build for errors.

## Technical details
- Reuse the existing customer fields and staff-only database permissions.
- Keep all unrelated insurance and claim behavior unchanged.

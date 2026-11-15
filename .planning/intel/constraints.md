# Ingested Technical & Product Constraints

Source: `docs/PRODUCT_SPEC.md` & `.planning/codebase/STACK.md`

## Architecture Constraints
- **C-01 (No Payment Gateway):** Zero escrow, zero online payment gateway, zero bank account collection. All payments settled peer-to-peer via UPI or cash upon delivery.
- **C-02 (No Delivery Merchant APIs):** Yuvnix does not integrate with Zepto/Blinkit/Swiggy private checkout APIs; the cart host places the order through their own consumer app.
- **C-03 (Student Role Immutability):** Student accounts cannot modify their own role. Administrative privileges require manual database assignment.
- **C-04 (Database-Enforced Authorization):** Security boundaries reside in PostgreSQL RLS policies, column privilege revocations, and SECURITY DEFINER RPC functions. Client-side state is strictly untrusted.
- **C-05 (Free for Students):** Zero platform monetization, service fees, or charges to students.

/** Internal frontend boundary, NOT a vendor API specification.
 * Implement a service with `kind:'live'` and async connect(store) -> cleanup().
 * Obtain the actual address, auth, payload and alarm rules from the owning team.
 */
export class LiveNodeAdapter{
 constructor({loadInitial,subscribe,decode}){this.kind='live';this.loadInitial=loadInitial;this.subscribeRemote=subscribe;this.decode=decode;}
 async connect(store){
  const payload=await this.loadInitial();store.replace(this.decode(payload));
  // Only configured upstream alarm results map to 'alarm'; never infer from motion/contact.
  const cleanup=await this.subscribeRemote(payload=>store.patch(this.decode(payload)));
  return()=>cleanup?.();
 }
}

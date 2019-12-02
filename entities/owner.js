const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
const OWNER = "Owner";

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

/*
**** OWNERS ****
Owners own crops
*/

function post_owner(name, owner_id, crops){
  var key = datastore.key(OWNER);
  const new_owner = {"name": name, "owner_id": owner_id, "crops": crops}
  return datastore.save({"key": key, "data": new_owner}).then(() => {return key});
}

function updateOwner(id, name, owner_id, crops){
  const key = datastore.key([OWNER, parseInt(id,10)]);
  const new_owner = {"name": name, "owner_id": owner_id, "crops": crops}
  return datastore.save({"key":key, "data":new_owner}).then(() => {return key});
}

function updateOwnersCrops(id, owner, crop_id, crop, deleteCrop){
  const key = datastore.key([OWNER, parseInt(id,10)]);
  var newCrops = [];
  for (var item of owner.crops){
    if (item.id != crop.id){
      newCrops.push(item);
    }
    else{
      if (!deleteCrop){
        newCrops.push(crop);
      }
    }
  }
  const new_owner = {"email": owner.email, "owner_id": owner.owner_id, "crops": newCrops}
  return datastore.save({"key":key, "data":new_owner}).then(() => {return key});
}

function getOwners(){
  const q = datastore.createQuery(OWNER);
  return datastore.runQuery(q).then( (entities) =>{
    return entities[0].map(fromDatastore);
  });
}

function deleteOwner(patch_id){
  const key = datastore.key([OWNER, parseInt(patch_id,10)]);
  return datastore.delete(key);
}

module.exports = {
	post_owner: post_owner,
	updateOwner: updateOwner,
	getOwners: getOwners,
  deleteOwner: deleteOwner,
  updateOwnersCrops: updateOwnersCrops
}
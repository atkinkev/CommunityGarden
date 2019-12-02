const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
const PATCH = "Patch";

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

/**** patches ****/
function post_patch(name, soil_type, fertilizer_type, last_watered){
  var key = datastore.key(PATCH);
  const new_patch = {"name": name, "soil_type": soil_type, "fertilizer_type": fertilizer_type, "last_watered": last_watered, "crops": []};
  return datastore.save({"key": key, "data": new_patch}).then(() => {return key});
}

function getPatch(patchId){
  const key = datastore.key([PATCH, parseInt(patchId,10)]);
  return datastore.get(key);
}

function getPatches(){
  const q = datastore.createQuery(PATCH);
  return datastore.runQuery(q).then( (entities) =>{
    return entities[0].map(fromDatastore);
  });
}

function deletePatch(patch_id){
  const key = datastore.key([PATCH, parseInt(patch_id,10)]);
  return datastore.delete(key);
}

function updateEntirePatch(id, name, soil_type, fertilizer_type, last_watered){
  const key = datastore.key([PATCH, parseInt(id,10)]);
  const new_patch = {"name": name, "soil_type": soil_type, "fertilizer_type": fertilizer_type, "last_watered": last_watered};
  return datastore.save({"key":key, "data":new_patch}).then(() => {return key});
}

module.exports = {
    post_patch: post_patch,
    getPatch: getPatch,
    getPatches: getPatches,
    deletePatch: deletePatch,
    updateEntirePatch: updateEntirePatch
};
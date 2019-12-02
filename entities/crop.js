const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
const CROP = "Crop";
const PATCH = "Patch";

function fromDatastore(item){
  item.id = item[Datastore.KEY].id;
  return item;
}

/*
**** CROPS ****
*/
function post_crop(newCrop){
  var key = datastore.key(CROP);
  const new_crop = {"name": newCrop.name, "owner": newCrop.owner, "patch_id": newCrop.patch_id, "description": newCrop.description, "age": newCrop.age};
  return datastore.save({"key": key, "data": new_crop}).then(() => {return key});
}

function getCrop(cropId){
  const key = datastore.key([CROP, parseInt(cropId,10)]);
  return datastore.get(key);
}

function getCrops(){
  const q = datastore.createQuery(CROP);
  return datastore.runQuery(q).then( (entities) =>{
    return entities[0].map(fromDatastore);
  });
}

function deleteCrop(crop_id){
  const key = datastore.key([CROP, parseInt(crop_id,10)]);
  return datastore.delete(key);
}

function updateEntireCrop(id, crop){
  const key = datastore.key([CROP, parseInt(id,10)]);
  const new_patch = {"name": crop.name, "description": crop.description, "age": crop.age, "patch_id": crop.patch_id, "owner": crop.owner};
  return datastore.save({"key":key, "data":new_patch}).then(() => {return key});
}

function addCropToPatch(patch_id, patch, crop){
  const key = datastore.key([PATCH, parseInt(patch_id,10)]);
  patch["crops"].push(crop);
  const newPatch = {"name": patch["name"], "soil_type": patch["soil_type"], "fertilizer_type": patch["fertilizer_type"], "last_watered": patch["last_watered"], "crops": patch["crops"]};
  return datastore.save({"key":key, "data":newPatch}).then(() => {return key});
}

function removeCropFromPatch(patch_id, crop_id, patch){
  const key = datastore.key([PATCH, parseInt(patch_id,10)]);
  var newCrops = [];
  // rebuild old patch without this crop
  for (var item of patch.crops){
    if (item.id != crop_id){
      newCrops.push(item);
    }
  }
  const newPatch = {"name": patch["name"], "soil_type": patch["soil_type"], "fertilizer_type": patch["fertilizer_type"], "last_watered": patch["last_watered"], "crops": newCrops};
  return datastore.save({"key":key, "data":newPatch}).then(() => {return key});
}

module.exports = {
	post_crop: post_crop,
	getCrops: getCrops,
	getCrop: getCrop,
	deleteCrop: deleteCrop,
  addCropToPatch: addCropToPatch,
  updateEntireCrop: updateEntireCrop,
  removeCropFromPatch: removeCropFromPatch
}
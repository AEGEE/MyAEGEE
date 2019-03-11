
    <!-- ########################### Edit Meal modal ###################### -->
    <div class="modal fade" id="mealModal">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
                    <h4 class="modal-title">Meal add/edit</h4>
                </div>
                <form name="mealForm" ng-submit="vm.submitForm()" class="margin-bottom-0" novalidate>
                    <div class="modal-body">
                        <div class="form-group m-b-20">
                            <label>Name*</label>
                            <input type="text" class="form-control" ng-model="vm.edited_meal.name" required placeholder="Name of the meal, e.g. 'Dinner in the gym'" />
                            <p class="label label-danger" ng-show="vm.errors.name">{{ vm.errors.name }}</p>
                        </div>
                        <div class="form-group m-b-20">
                            <label>Date*</label>
                            <!-- TODO use datepicker -->
                            <div class="input-group">
                              <input type="text" class="form-control" uib-datepicker-popup ng-model="vm.edited_meal.date" is-open="_picker_opened" datepicker-options="vm.edited_meal.date_options" ng-required="true" close-text="Close"  />
                              <span class="input-group-btn">
                                <button type="button" class="btn btn-default" ng-click="_picker_opened=!_picker_opened;"><i class="fa fa-calendar"></i></button>
                              </span>
                            </div>
                            <p class="label label-danger" ng-show="vm.errors.date">{{ vm.errors.date }}</p>
                        </div>
                        <div class="form-group m-b-20">
                          <label>Time</label>
                          <div uib-timepicker ng-model="vm.edited_meal.picked_time" hour-step="1" minute-step="15" show-meridian="false" show-spinners="false"></div>
                          <p class="label label-danger" ng-show="vm.errors.time">{{ vm.errors.time }}</p>
                        </div>
                        <h2>Recipes <small>Add as many recipes to a meal as you wish</small></h2>
                        <p class="label label-danger" ng-show="vm.errors.recipes_ingredients">Some recipes could not be validated</p>
                        <div class="row m-b-10 alert" style="background: #ddd;" ng-repeat="mr in vm.edited_meal.meals_recipes">
                          <div class="row">
                            <div class="col-md-3">
                              <div class="input-group">
                                <input type="number" class="form-control" ng-model="mr.person_count">
                                <span class="input-group-addon">ppl</span>
                              </div>
                              <p class="label label-danger" ng-show="vm.errors.meals_recipes[$index].person_count">{{ vm.errors.meals_recipes[$index].person_count }}</p>
                            </div>
                            <div class="col-md-9">
                              <label style="padding-top: 8px;" >{{ mr.recipe.name }}</label>
                              <button class="btn btn-sm btn-danger pull-right" ng-click="vm.edited_meal.meals_recipes.splice($index, 1)"><i class="fa fa-minus"></i></button>
                              <p class="label label-danger" ng-show="vm.errors.meals_recipes[$index].recipe_id">{{ vm.errors.meals_recipes[$index].recipe_id }}</p>
                            </div>
                          </div>
                        </div>
                        <div class="row m-b-10 alert" style="background: #ddd;">
                          <div class="row">
                            <div class="col-md-3">
                              <div class="input-group">
                                <input type="number" class="form-control" disabled placeholder="Add new">
                              </div>
                            </div>
                            <div class="col-md-9">
                              <angucomplete-alt class="pull-left"
                                id="recipesAutocomplete"
                                placeholder="Search recipes"
                                pause="50"
                                selected-object="tmpRecipe"
                                remote-api-handler="vm.fetchRecipes"
                                title-field="name"
                                description-field="description"
                                minlength="1"
                                input-class="form-control form-control-small">
                              </angucomplete-alt>
                              <button type="button" class="btn btn-sm btn-success pull-right" ng-click="vm.addRecipe(tmpRecipe)"><i class="fa fa-plus"></i></button>
                            </div>
                          </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-sm btn-danger" data-dismiss="modal"><i class="fa fa-ban"></i> Close</button>
                        <button type="submit" ng-disabled="bodyForm.$pristine || bodyForm.$invalid" class="btn btn-sm btn-success"><i class="fa fa-save"></i> Save </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
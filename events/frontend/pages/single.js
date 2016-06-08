

eventsApp.controller('singleController', function($scope, $http, $routeParams) {
	$scope.apiURL = apiURL;
	
	$http.get(apiURL + '/single/' + $routeParams.event_id).success( function(response) {
      $scope.event = response; 
   });
});
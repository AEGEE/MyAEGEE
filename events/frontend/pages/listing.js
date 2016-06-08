

eventsApp.controller('listingController', function($scope, $http) {
	$scope.apiURL = apiURL;
	
	$http.get(apiURL).success( function(response) {
      $scope.events = response; 
   });
});

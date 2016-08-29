

eventsApp.controller('newEventController', function($scope, $http, $routeParams, $location) {

	// Enable DateTimepickers on the page
	angular.element(document).ready(function () {
		 $('#startsDateTimePicker').datetimepicker();
		 $('#endsDateTimePicker').datetimepicker();
		 $('#deadlineDateTimePicker').datetimepicker();
	});

	$scope.heading = "New Event";
	$scope.event = {};

	// If no route params are given, the user wants to create a new event -> Post
	$scope.submitForm = function() {
		$http.post(apiURL, $scope.event).then(function successCallback(response) {
			$location.path('/single/' + response.data._id);
			console.log(response);
		}, function errorCallback(response) {
			console.log(response);
		});
	}

	// Load data from server, if eventid specified
	// Also use another submit message
	if($routeParams.event_id) {
		var resourceURL = apiURL + '/single/' + $routeParams.event_id;
		$scope.heading = "Edit Event";

		// Edit the event with a put
		$scope.submitForm = function() {
			$http.put(resourceURL, $scope.event).then(function successCallback(response) {
				$location.path('/single/' + $routeParams.event_id);
			}, function errorCallback(response) {
				console.log(response);

			});
		}
		
		$http.get(resourceURL).success( function(response) {
	      	$scope.event = response;

	      	// Ugly fix as AngularJs datetime-local inputs require Date objects
	      	$scope.event.starts = new Date(response.starts);
	      	$scope.event.ends = new Date(response.ends);
	      	$scope.event.application_deadline = new Date(response.application_deadline);

	   	});
	}

});
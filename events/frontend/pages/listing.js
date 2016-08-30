(function ()
{
    'use strict';
    var baseUrl = baseUrlRepository['oms-events'];
    var apiURL = baseUrl + 'api/';


    angular
        .module('app.events', [])
        .config(config)
        .controller('ListingController', ListingController)
        .controller('SingleController', SingleController)
        .controller('NewController', NewController);

    /** @ngInject */
    function config($stateProvider)
    {
        // State
         $stateProvider
            .state('app.events', {
                url: '/events',
                data: {'pageTitle': 'All Events'},
                views   : {
                    'pageContent@app': {
                        templateUrl: baseUrl + 'frontend/pages/listing.html',
                        controller: 'ListingController as vm'
                    }
                }
            })
			.state('app.events.single', {
            	url: '/single/:id',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/single.html',
            			controller: 'SingleController as vm'
            		}
            	}
            })
            .state('app.events.edit', {
            	url: '/edit/:id',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            .state('app.events.new', {
            	url: '/new',
            	views: {
            		'pageContent@app': {
            			templateUrl: baseUrl + 'frontend/pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            ;
    }

    function ListingController($scope, $http) {        
	
		// Fetch events from backend
		$http.get(apiURL).success(function(response) {
			$scope.events = response; 
		});
    }

    function SingleController($scope, $http, $stateParams) {

		$http.get(apiURL + 'single/' + $stateParams.id).success( function(response) {
			$scope.event = response; 
		});
	}



function NewController($scope, $http, $stateParams, $state, $filter) {

	angular.element(document).ready(function () {
		$('#startsDateTimePicker').datetimepicker();
        $("#startsDateTimePicker").on("dp.change", function() {$scope.event.starts = $("#startsDateTimePicker > input").val();});

		$('#endsDateTimePicker').datetimepicker();
        $("#endsDateTimePicker").on("dp.change", function() {$scope.event.ends = $("#endsDateTimePicker > input").val();});

		$('#deadlineDateTimePicker').datetimepicker();
        $("#deadlineDateTimePicker").on("dp.change", function() {$scope.event.application_deadline = $("#deadlineDateTimePicker > input").val();});

	});

	$scope.heading = "New Event";
    $scope.event = {starts: '', ends: ''};

	// If no route params are given, the user wants to create a new event -> Post
	$scope.submitForm = function() {
        console.log($scope.event);
		$http.post(apiURL, $scope.event).then(function successCallback(response) {
			$state.go('app.events.single', {id: response.data._id});
			console.log(response);
		}, function errorCallback(response) {
			console.log(response);
		});
	}

	// Load data from server, if eventid specified
	// Also use another submit message
	if($stateParams.id) {
		var resourceURL = apiURL + '/single/' + $stateParams.id;
		$scope.heading = "Edit Event";

		// Edit the event with a put
		$scope.submitForm = function() {
			$http.put(resourceURL, $scope.event).then(function successCallback(response) {
				$state.go('app.events.single', {id: $stateParams.id});
			}, function errorCallback(response) {
				console.log(response);

			});
		}
		
		$http.get(resourceURL).success( function(response) {
	      	$scope.event = response;
	      	$("#startsDateTimePicker > input").val($filter('date')(response.starts, 'MM/dd/yyyy h:mm a'));
            $("#endsDateTimePicker > input").val($filter('date')(response.ends, 'MM/dd/yyyy h:mm a'));
            $("#deadlineDateTimePicker > input").val($filter('date')(response.application_deadline, 'MM/dd/yyyy h:mm a'));

	   	});
	}

}

})();

